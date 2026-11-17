'use client';

import { useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  X,
  Landmark,
  Truck,
  MessageCircle,
  CreditCard,
} from 'lucide-react';
import Button from '@/app/components/ui/Button';
import { waNumber } from '@/lib/phone';
import { pluginOn } from '@/lib/plugins';
import { planFor } from '@/lib/plans';
import { formatMoney, type ForumSummary, type ProductVariant, type SiteOrder, type SiteProduct } from '@/lib/forums';
import { NIGERIAN_STATES } from '@/lib/shipping';

export interface StorefrontCartEntry {
  key: string;
  product: SiteProduct;
  variant?: ProductVariant;
  qty: number;
}

interface Props {
  site: ForumSummary;
  currency: string;
  cart: StorefrontCartEntry[];
  cartCount: number;
  placedOrder: SiteOrder | null;
  onClose: () => void;
  onContinueShopping: () => void;
  onUpdateQty: (key: string, delta: number) => void;
  couponInput: string;
  setCouponInput: (v: string) => void;
  applyCoupon: () => void;
  couponMsg: string;
  coupon: { code: string; discount: number } | null;
  discount: number;
  hasPhysical: boolean;
  showShippingZones: boolean;
  hasZones: boolean;
  shippingCalc: { fee: number; zoneName: string; freeDeliveryApplied: boolean };
  payable: number;
  deliveryMethod: 'delivery' | 'pickup';
  setDeliveryMethod: (v: 'delivery' | 'pickup') => void;
  deliveryState: string;
  setDeliveryState: (v: string) => void;
  deliveryAddress: string;
  setDeliveryAddress: (v: string) => void;
  buyerName: string;
  setBuyerName: (v: string) => void;
  buyerEmail: string;
  setBuyerEmail: (v: string) => void;
  buyerPhone: string;
  setBuyerPhone: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  abandonedCartsEnabled: boolean;
  canPayOnline?: boolean;
  paymentMethod: 'manual_transfer' | 'pay_on_delivery' | 'paystack';
  setPaymentMethod: (v: 'manual_transfer' | 'pay_on_delivery' | 'paystack') => void;
  paymentRef: string;
  setPaymentRef: (v: string) => void;
  proofNote: string;
  setProofNote: (v: string) => void;
  marketingConsent: boolean;
  setMarketingConsent: (v: boolean) => void;
  checkoutError: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function StorefrontCheckoutDrawer(props: Props) {
  const {
    site,
    currency,
    cart,
    cartCount,
    placedOrder,
    onClose,
    onContinueShopping,
    onUpdateQty,
    couponInput,
    setCouponInput,
    applyCoupon,
    couponMsg,
    coupon,
    discount,
    hasPhysical,
    showShippingZones,
    hasZones,
    shippingCalc,
    payable,
    deliveryMethod,
    setDeliveryMethod,
    deliveryState,
    setDeliveryState,
    deliveryAddress,
    setDeliveryAddress,
    buyerName,
    setBuyerName,
    buyerEmail,
    setBuyerEmail,
    buyerPhone,
    setBuyerPhone,
    notes,
    setNotes,
    abandonedCartsEnabled,
    paymentMethod,
    setPaymentMethod,
    paymentRef,
    setPaymentRef,
    proofNote,
    setProofNote,
    marketingConsent,
    setMarketingConsent,
    checkoutError,
    submitting,
    onSubmit,
  } = props;

  const [copiedAcct, setCopiedAcct] = useState(false);
  const hasBank = !!(site.bank_name && site.bank_account_number);
  // Printable receipts are a Pro feature, so the link only shows where it will open.
  const receiptsOn = pluginOn('receipts', site.plan_tier, site.plan_expires_at, site.plugins);
  // Which ways to pay this store offers: online first, then bank transfer and pay on delivery where the plan includes them.
  const sitePlan = planFor(site.plan_tier, site.plan_expires_at);
  const methods = [props.canPayOnline && 'paystack', sitePlan.bankTransfer && 'manual_transfer', sitePlan.payOnDelivery && 'pay_on_delivery'].filter(Boolean) as string[];

  const handleCopyAccount = async () => {
    if (!site.bank_account_number) return;
    await navigator.clipboard.writeText(site.bank_account_number).catch(() => {});
    setCopiedAcct(true);
    setTimeout(() => setCopiedAcct(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md bg-primary border-l border-theme h-full overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-theme pb-3">
          <h3 className="font-black text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-accent" />
            {placedOrder ? 'Order Placed' : `Your Cart (${cartCount})`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="w-10 h-10 rounded-full hover:bg-card text-secondary flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {placedOrder ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" /> {placedOrder.payment_status === 'paid' ? 'Paid' : 'Order placed'}: {placedOrder.order_code}
              </div>
              <p className="text-xs text-secondary">
                Total: <strong className="text-primary">{formatMoney(placedOrder.total_amount, currency)}</strong>
              </p>
              <p className="text-xs text-primary">
                {placedOrder.payment_status === 'paid'
                  ? 'Payment received. Thank you!'
                  : placedOrder.payment_method === 'pay_on_delivery'
                  ? 'You will pay when your order arrives.'
                  : hasBank
                  ? 'Not paid yet. Send the transfer using the details below, then the store will confirm it.'
                  : 'Not paid yet. This store has not added a way to pay online, so the store will contact you to arrange payment.'}
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

            <div className="flex flex-wrap gap-2">
              {receiptsOn && <a
                href={`/receipt/${encodeURIComponent(placedOrder.order_code)}?email=${encodeURIComponent(placedOrder.buyer_email)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[140px] h-10 px-4 rounded-xl border border-theme hover:bg-hover text-xs font-semibold flex items-center justify-center"
              >
                Printable receipt
              </a>}
              {site.whatsapp_number && (
                <a
                  href={`https://wa.me/${waNumber(site.whatsapp_number)}?text=${encodeURIComponent(
                    `Hi ${site.name}, I just placed order ${placedOrder.order_code} (${formatMoney(placedOrder.total_amount, currency)}).`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 min-w-[160px] h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" /> Send Receipt on WhatsApp
                </a>
              )}
            </div>

            <Button variant="secondary" onClick={onContinueShopping}>
              Continue Shopping
            </Button>
          </div>
        ) : cart.length === 0 ? (
          <p className="text-sm text-secondary py-10 text-center">Your cart is empty. Add items to check out.</p>
        ) : (
          <>
            <div className="space-y-2.5">
              {cart.map(({ key, product, variant, qty }) => {
                const unitPrice = variant ? Number(variant.price) : Number(product.price);
                return (
                  <div key={key} className="p-3 rounded-xl bg-card border border-theme flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">
                        {product.title}{variant ? ` · ${variant.label}` : ''}
                      </p>
                      <p className="text-xs text-secondary">{formatMoney(unitPrice, currency)} each</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => onUpdateQty(key, -1)} aria-label="Decrease quantity" className="w-8 h-8 rounded-lg bg-primary border border-theme flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center">{qty}</span>
                      <button type="button" onClick={() => onUpdateQty(key, 1)} aria-label="Increase quantity" className="w-8 h-8 rounded-lg bg-primary border border-theme flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => onUpdateQty(key, -qty)} aria-label="Remove item" className="w-8 h-8 flex items-center justify-center text-danger ml-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-theme space-y-2">
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Discount code"
                  aria-label="Discount code"
                  className="input-box flex-1 !py-2 text-sm font-mono"
                />
                <button type="button" onClick={applyCoupon} className="px-4 h-10 text-sm font-medium rounded-full border border-theme hover:bg-hover">Apply</button>
              </div>
              {couponMsg && <p className="text-xs text-danger">{couponMsg}</p>}
              {coupon && <p className="text-xs text-success">Code {coupon.code} applied: {formatMoney(discount, currency)} off</p>}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-theme text-xs">
              {hasPhysical && showShippingZones && (deliveryMethod === 'pickup' || hasZones) && (
                <div className="flex items-center justify-between text-secondary">
                  <span>
                    {deliveryMethod === 'pickup'
                      ? 'Store pickup'
                      : shippingCalc.zoneName
                      ? `Delivery (${shippingCalc.zoneName})`
                      : 'Delivery'}
                  </span>
                  <span>
                    {deliveryMethod === 'pickup' || shippingCalc.freeDeliveryApplied
                      ? <span className="text-success font-medium">Free</span>
                      : formatMoney(shippingCalc.fee, currency)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between font-black text-base pt-1">
                <span>Total</span>
                <span>{formatMoney(payable, currency)}</span>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-3 pt-2 border-t border-theme">
              <h4 className="text-xs font-semibold text-secondary">Customer & delivery</h4>
              {showShippingZones && hasPhysical && site.pickup_address && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('delivery')}
                    className={`h-10 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      deliveryMethod === 'delivery' ? 'border-accent bg-accent/10 text-accent' : 'border-theme bg-card text-secondary'
                    }`}
                  >
                    Deliver to me
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('pickup')}
                    className={`h-10 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      deliveryMethod === 'pickup' ? 'border-accent bg-accent/10 text-accent' : 'border-theme bg-card text-secondary'
                    }`}
                  >
                    Store pickup (Free)
                  </button>
                </div>
              )}
              {deliveryMethod === 'pickup' && site.pickup_address && (
                <p className="text-xs text-secondary p-2.5 rounded-xl bg-card border border-theme">
                  Pickup location: <span className="text-primary font-medium">{site.pickup_address}</span>
                </p>
              )}
              <input
                type="text"
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Your Full Name"
                aria-label="Full name"
                className="w-full px-3 py-2.5 rounded-xl bg-card border border-theme text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  required
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="Email Address"
                  aria-label="Email address"
                  className="w-full px-3 py-2.5 rounded-xl bg-card border border-theme text-xs"
                />
                <input
                  type="tel"
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="Phone / WhatsApp"
                  aria-label="Phone or WhatsApp"
                  className="w-full px-3 py-2.5 rounded-xl bg-card border border-theme text-xs"
                />
              </div>
              {abandonedCartsEnabled && (
                <p className="text-[11px] text-secondary">
                  Your cart is saved briefly while you check out so we can remind you if you step away.
                </p>
              )}
              {deliveryMethod === 'delivery' && (
                <>
                  {showShippingZones && hasPhysical && hasZones && (
                    <select
                      value={deliveryState}
                      onChange={(e) => setDeliveryState(e.target.value)}
                      aria-label="Delivery state"
                      className="w-full px-3 py-2.5 rounded-xl bg-card border border-theme text-xs"
                    >
                      {NIGERIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Delivery Address (for physical items)"
                    aria-label="Delivery address"
                    className="w-full px-3 py-2.5 rounded-xl bg-card border border-theme text-xs"
                  />
                </>
              )}
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Order note / brief (optional)"
                aria-label="Order note"
                className="w-full px-3 py-2.5 rounded-xl bg-card border border-theme text-xs"
              />

              <label className="flex items-center gap-2.5 text-xs text-secondary cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="w-4 h-4 shrink-0"
                />
                Send me store updates and offers by email
              </label>

              <h4 className="text-xs font-semibold text-secondary pt-2">Payment method</h4>
              {methods.length === 0 && (
                <p className="text-xs text-secondary p-3 rounded-xl bg-card border border-theme">
                  This store takes orders on WhatsApp. {site.whatsapp_number ? 'Tap the button below to send your order.' : 'Please contact the store to order.'}
                </p>
              )}
              <div className={`grid gap-2 ${methods.length >= 3 ? 'grid-cols-3' : methods.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {props.canPayOnline && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('paystack')}
                    className={`h-10 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      paymentMethod === 'paystack' ? 'border-accent bg-accent/10 text-accent' : 'border-theme bg-card text-secondary'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Pay Online
                  </button>
                )}
                {sitePlan.bankTransfer && <button
                  type="button"
                  onClick={() => setPaymentMethod('manual_transfer')}
                  className={`h-10 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'manual_transfer' ? 'border-accent bg-accent/10 text-accent' : 'border-theme bg-card text-secondary'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" /> Bank Transfer
                </button>}
                {sitePlan.payOnDelivery && <button
                  type="button"
                  onClick={() => setPaymentMethod('pay_on_delivery')}
                  className={`h-10 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'pay_on_delivery' ? 'border-accent bg-accent/10 text-accent' : 'border-theme bg-card text-secondary'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" /> Pay on Delivery
                </button>}
              </div>
              {paymentMethod === 'paystack' && (
                <p className="text-xs text-secondary p-3 rounded-xl bg-card border border-theme">
                  You will be redirected to secure Paystack checkout (Card, Bank Transfer, USSD) to complete payment for this order.
                </p>
              )}

              {paymentMethod === 'manual_transfer' && sitePlan.bankTransfer && (
                <div className="p-3.5 rounded-xl bg-card border border-theme space-y-2 text-xs">
                  {hasBank ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">{site.bank_name}</span>
                        <button type="button" onClick={handleCopyAccount} className="text-accent flex items-center gap-1 font-mono">
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
                    aria-label="Transfer reference"
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-theme text-xs"
                  />
                  <input
                    type="text"
                    value={proofNote}
                    onChange={(e) => setProofNote(e.target.value)}
                    placeholder="Payment note (e.g. Sent from GTB at 2:15pm)"
                    aria-label="Payment proof note"
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-theme text-xs"
                  />
                </div>
              )}

              {checkoutError && <p className="text-xs text-danger" role="alert">{checkoutError}</p>}
              {paymentMethod === 'paystack' && props.canPayOnline && (
                <p className="text-[11px] text-secondary text-center">Secure payment by Paystack. Your card details never reach this store.</p>
              )}
              {methods.length === 0 ? (
                site.whatsapp_number ? (
                  <a
                    href={`https://wa.me/${waNumber(site.whatsapp_number)}?text=${encodeURIComponent(`Hi ${site.name}, I would like to order from your store.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" /> Order on WhatsApp
                  </a>
                ) : null
              ) : (
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Placing Order...' : `Place Order (${formatMoney(payable, currency)})`}
                </Button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
