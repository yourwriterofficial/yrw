'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Search, Download, Printer, Star, User, Package, LogIn } from 'lucide-react';
import { formatMoney, type ForumSummary, type SiteOrder } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { supabase } from '@/lib/supabaseClient';

const PAY_LABEL: Record<string, string> = {
  pending: 'Awaiting payment',
  proof_submitted: 'Payment being checked',
  paid: 'Paid',
  rejected: 'Payment not confirmed',
};

const SHIP_LABEL: Record<string, string> = {
  pending: 'Not started',
  processing: 'Being prepared',
  shipped: 'On its way',
  completed: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrderTrackingModal({
  site,
  initialCode = '',
  initialEmail = '',
  onClose,
}: {
  site: ForumSummary;
  initialCode?: string;
  initialEmail?: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'track' | 'profile'>('track');
  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<SiteOrder | null>(null);
  const [downloads, setDownloads] = useState<{ title: string; url: string }[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myAuthed, setMyAuthed] = useState<boolean | null>(null);
  const [myProfile, setMyProfile] = useState<{ email: string; name: string; orders_count: number; paid_orders_count: number; total_spent: number } | null>(null);
  const [myOrders, setMyOrders] = useState<SiteOrder[]>([]);
  const [myDownloads, setMyDownloads] = useState<Record<string, { title: string; url: string }[]>>({});
  const [myError, setMyError] = useState('');
  const [reviewingPid, setReviewingPid] = useState<string | null>(null);
  const [revRating, setRevRating] = useState(5);
  const [revBody, setRevBody] = useState('');
  const [revBusy, setRevBusy] = useState(false);
  const [revMsg, setRevMsg] = useState('');
  const [reviewedPids, setReviewedPids] = useState<Record<string, boolean>>({});
  const currency = site.currency || 'NGN';
  const plan = planFor(site.plan_tier);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session?.user) {
        setMyAuthed(true);
        if (session.user.email && !email) {
          setEmail(session.user.email);
        }
      } else {
        setMyAuthed(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMyOrders = async () => {
    setMyLoading(true);
    setMyError('');
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/my-orders`, { cache: 'no-store' });
      if (res.status === 401) {
        setMyAuthed(false);
        setMyLoading(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMyError(data.error || 'Could not load your orders.');
      } else {
        setMyAuthed(true);
        setMyProfile(data.profile || null);
        setMyOrders(data.orders || []);
        setMyDownloads(data.downloadsByCode || {});
      }
    } catch {
      setMyError('Could not reach the server.');
    }
    setMyLoading(false);
  };

  useEffect(() => {
    if (tab === 'profile' && myAuthed && myOrders.length === 0 && !myLoading) {
      loadMyOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, myAuthed]);

  const postReview = async (e: React.FormEvent, productId: string) => {
    e.preventDefault();
    if (!order) return;
    setRevBusy(true);
    setRevMsg('');
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          order_code: order.order_code,
          email: email.trim().toLowerCase(),
          rating: revRating,
          body: revBody.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRevMsg(data.error || 'Could not submit review.');
      } else {
        setReviewedPids((prev) => ({ ...prev, [productId]: true }));
        setReviewingPid(null);
        setRevBody('');
      }
    } catch {
      setRevMsg('Could not reach the server.');
    }
    setRevBusy(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    setDownloads([]);
    setBusy(true);
    try {
      const qs = new URLSearchParams({ code: code.trim(), email: email.trim().toLowerCase() });
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/orders?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order) {
        setError(res.status === 429 ? (data.error || 'Too many attempts. Please wait.') : 'Order not found. Check your order code and email address.');
      } else {
        setOrder(data.order);
        setDownloads(data.downloads || []);
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-order-title"
    >
      <div
        className="w-full sm:max-w-lg bg-primary border border-theme rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-theme pb-3">
          <div>
            <h2 id="track-order-title" className="g-h3">Orders &amp; Profile</h2>
            <p className="text-xs text-secondary mt-0.5">Track by order code or view your orders on {site.name}.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order tracker"
            className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center text-secondary hover:text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-secondary/40 border border-theme text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab('track')}
            className={`min-h-9 rounded-full inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
              tab === 'track' ? 'bg-accent text-[var(--accent-foreground)] font-semibold' : 'text-secondary hover:text-primary'
            }`}
          >
            <Search className="w-3.5 h-3.5" /> Track by code
          </button>
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`min-h-9 rounded-full inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
              tab === 'profile' ? 'bg-accent text-[var(--accent-foreground)] font-semibold' : 'text-secondary hover:text-primary'
            }`}
          >
            <User className="w-3.5 h-3.5" /> My orders
          </button>
        </div>

        {tab === 'profile' ? (
          <div className="space-y-3">
            {myAuthed === false ? (
              <div className="g-card p-5 text-center space-y-3">
                <Package className="w-8 h-8 text-accent mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-primary">Sign in to view your orders on {site.name}</p>
                  <p className="text-xs text-secondary">
                    Your order history, digital downloads, and receipts for this store stay private to your verified account.
                  </p>
                </div>
                <Link
                  href={`/login?next=${encodeURIComponent(`/forums/${site.slug}?track=1`)}`}
                  className="inline-flex items-center justify-center gap-2 min-h-10 px-5 rounded-full bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-xs font-semibold"
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign in
                </Link>
              </div>
            ) : myLoading ? (
              <p className="text-sm text-secondary py-6 text-center">Loading your orders…</p>
            ) : myError ? (
              <p className="text-sm text-danger" role="alert">{myError}</p>
            ) : (
              <>
                {myProfile && (
                  <div className="p-3.5 rounded-2xl bg-secondary/40 border border-theme flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-primary truncate">{myProfile.name || myProfile.email}</p>
                      <p className="text-secondary truncate">{myProfile.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-primary">{myProfile.orders_count} order{myProfile.orders_count === 1 ? '' : 's'}</p>
                      <p className="text-secondary">{formatMoney(myProfile.total_spent, currency)} spent</p>
                    </div>
                  </div>
                )}
                {myOrders.length === 0 ? (
                  <div className="g-card p-5 text-center text-xs text-secondary">
                    You have not placed any orders on {site.name} yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {myOrders.map((o) => {
                      const dl = myDownloads[o.order_code] || [];
                      return (
                        <div key={o.id} className="g-card p-3.5 space-y-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-mono font-bold text-sm text-primary">{o.order_code}</p>
                              <p className="text-secondary">
                                {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <p className="font-bold text-sm text-primary">{formatMoney(o.total_amount, currency)}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="px-2.5 py-1 rounded-full bg-secondary/50 border border-theme font-medium">
                              {PAY_LABEL[o.payment_status] || o.payment_status}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-secondary/50 border border-theme font-medium">
                              {SHIP_LABEL[o.fulfillment_status] || o.fulfillment_status}
                            </span>
                          </div>
                          <div className="space-y-1 border-t border-theme pt-2">
                            {o.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between gap-2 text-secondary">
                                <span>{it.qty} × {it.title}</span>
                                <span className="shrink-0">{formatMoney(Number(it.price) * it.qty, currency)}</span>
                              </div>
                            ))}
                          </div>
                          {o.payment_status === 'paid' && dl.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                              <p className="font-semibold text-emerald-400 flex items-center gap-1">
                                <Download className="w-3 h-3" /> Downloads
                              </p>
                              {dl.map((d, idx) => (
                                <a key={idx} href={d.url} target="_blank" rel="noopener noreferrer" className="block text-accent hover:underline truncate">
                                  Download {d.title}
                                </a>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setOrder(o);
                                setDownloads(dl);
                                setCode(o.order_code);
                                setEmail(o.buyer_email || myProfile?.email || '');
                                setTab('track');
                              }}
                              className="px-3 min-h-8 rounded-full border border-theme hover:bg-hover font-medium cursor-pointer"
                            >
                              Details &amp; review
                            </button>
                            {plan.receipts && (
                              <a
                                href={`/receipt/${encodeURIComponent(o.order_code)}?slug=${encodeURIComponent(site.slug)}&email=${encodeURIComponent(o.buyer_email || myProfile?.email || '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 min-h-8 rounded-full border border-theme hover:bg-hover font-medium inline-flex items-center gap-1"
                              >
                                <Printer className="w-3 h-3" /> Receipt
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
        <>
        <form onSubmit={lookup} className="space-y-3">
          <div>
            <label htmlFor="track-code" className="block text-sm font-medium mb-1">Order code</label>
            <input
              id="track-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ORD-XXXXXX"
              className="input-box w-full font-mono text-sm"
            />
          </div>
          <div>
            <label htmlFor="track-email" className="block text-sm font-medium mb-1">Email address</label>
            <input
              id="track-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-box w-full text-sm"
            />
          </div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-11 rounded-full bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            {busy ? 'Checking…' : 'Check order status'}
          </button>
        </form>

        {order && (
          <div className="g-card p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono font-bold text-sm">{order.order_code}</p>
                <p className="text-xs text-secondary">{new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <p className="font-bold text-base">{formatMoney(order.total_amount, currency)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-secondary/40 border border-theme">
                <p className="text-secondary">Payment</p>
                <p className="font-semibold text-primary mt-0.5">{PAY_LABEL[order.payment_status] || order.payment_status}</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/40 border border-theme">
                <p className="text-secondary">Delivery</p>
                <p className="font-semibold text-primary mt-0.5">{SHIP_LABEL[order.fulfillment_status] || order.fulfillment_status}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-sm border-t border-theme pt-3">
              {order.items.map((it, idx) => (
                <div key={idx} className="flex justify-between gap-2 text-xs">
                  <span>{it.qty} × {it.title}</span>
                  <span className="text-secondary shrink-0">{formatMoney(Number(it.price) * it.qty, currency)}</span>
                </div>
              ))}
              {Number(order.discount_amount || 0) > 0 && (
                <div className="flex justify-between gap-2 text-xs text-success">
                  <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                  <span>-{formatMoney(Number(order.discount_amount), currency)}</span>
                </div>
              )}
              {Number(order.shipping_fee || 0) > 0 && (
                <div className="flex justify-between gap-2 text-xs text-secondary">
                  <span>Delivery{order.shipping_zone ? ` (${order.shipping_zone})` : ''}</span>
                  <span>{formatMoney(Number(order.shipping_fee), currency)}</span>
                </div>
              )}
            </div>

            {order.payment_status === 'paid' && downloads.length > 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Your digital downloads
                </p>
                <ul className="space-y-1.5 text-xs">
                  {downloads.map((d, idx) => (
                    <li key={idx}>
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-accent font-medium hover:underline break-all">
                        Download {d.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.receipts && (
              <a
                href={`/receipt/${encodeURIComponent(order.order_code)}?slug=${encodeURIComponent(site.slug)}&email=${encodeURIComponent(email.trim().toLowerCase())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-10 px-4 py-2 rounded-full border border-theme hover:bg-hover text-xs font-medium inline-flex items-center justify-center gap-2"
              >
                <Printer className="w-3.5 h-3.5" /> Print or save receipt (PDF)
              </a>
            )}

            {order.payment_status === 'paid' && plan.reviews && (
              <div className="pt-3 border-t border-theme space-y-2.5">
                <p className="text-xs font-semibold text-primary">Rate items from this order</p>
                {Array.from(new Map(order.items.filter((i) => i.product_id).map((i) => [i.product_id!, i])).values()).map((it) => {
                  const pid = it.product_id!;
                  const done = !!reviewedPids[pid];
                  return (
                    <div key={pid} className="text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-secondary">{it.title}</span>
                        {done ? (
                          <span className="text-success font-medium shrink-0">Reviewed</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setReviewingPid(reviewingPid === pid ? null : pid); setRevMsg(''); }}
                            className="px-3 min-h-9 rounded-full border border-theme hover:bg-hover font-medium shrink-0 cursor-pointer"
                          >
                            {reviewingPid === pid ? 'Cancel' : 'Leave a review'}
                          </button>
                        )}
                      </div>
                      {reviewingPid === pid && !done && (
                        <form onSubmit={(e) => postReview(e, pid)} className="p-3 rounded-xl bg-secondary/40 border border-theme space-y-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setRevRating(n)}
                                aria-label={`${n} stars`}
                                className="w-9 h-9 rounded-full hover:bg-hover flex items-center justify-center cursor-pointer"
                              >
                                <Star className={`w-4 h-4 ${n <= revRating ? 'fill-amber-400 text-amber-400' : 'text-secondary/40'}`} />
                              </button>
                            ))}
                          </div>
                          <textarea
                            rows={2}
                            maxLength={1500}
                            value={revBody}
                            onChange={(e) => setRevBody(e.target.value)}
                            placeholder="Share a quick comment (optional)"
                            className="input-box w-full text-xs"
                          />
                          {revMsg && <p className="text-danger">{revMsg}</p>}
                          <button
                            type="submit"
                            disabled={revBusy}
                            className="min-h-9 px-4 rounded-full bg-accent text-[var(--accent-foreground)] font-semibold disabled:opacity-50 cursor-pointer"
                          >
                            {revBusy ? 'Saving…' : 'Submit review'}
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
