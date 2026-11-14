'use client';

import { useMemo, useState } from 'react';
import { formatMoney, type SiteOrder } from '@/lib/forums';
import { waLink } from '@/lib/phone';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';
import OrderRefundModal from './OrderRefundModal';

const PAY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'proof_submitted', label: 'Needs checking' },
  { value: 'pending', label: 'Awaiting payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
] as const;

const PAY_LABEL: Record<string, string> = { pending: 'Awaiting payment', proof_submitted: 'Needs checking', paid: 'Paid', rejected: 'Rejected' };
const PAY_TONE: Record<string, string> = {
  pending: 'bg-secondary text-secondary',
  proof_submitted: 'bg-accent text-[var(--accent-foreground)]',
  paid: 'bg-[var(--success-bg)] text-success',
  rejected: 'bg-[var(--danger-bg)] text-danger',
};

export default function OrdersTab({ site, orders, reload }: { site: Site; orders: SiteOrder[]; reload: () => Promise<void> }) {
  const [filter, setFilter] = useState<(typeof PAY_FILTERS)[number]['value']>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [refundOrder, setRefundOrder] = useState<SiteOrder | null>(null);
  const [error, setError] = useState('');
  const plan = planFor(site.plan_tier, site.plan_expires_at);

  const shown = useMemo(() => orders.filter((o) => filter === 'all' || o.payment_status === filter), [orders, filter]);
  const count = (v: string) => (v === 'all' ? orders.length : orders.filter((o) => o.payment_status === v).length);

  const patch = async (o: SiteOrder, body: Partial<Pick<SiteOrder, 'payment_status' | 'fulfillment_status' | 'internal_note'>>) => {
    setBusyId(o.id);
    setError('');
    const r = await jsonFetch(`/api/forums/${site.slug}/orders/${o.id}`, { method: 'PATCH', body });
    if (!r.ok) setError(r.data.error || 'Could not update the order.');
    await reload();
    setBusyId(null);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {PAY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 h-9 rounded-full text-sm font-medium border transition-colors ${filter === f.value ? 'bg-accent text-[var(--accent-foreground)] border-accent' : 'border-theme text-secondary hover:bg-hover'}`}
          >
            {f.label} <span className="opacity-70">{count(f.value)}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-danger mb-4" role="alert">{error}</p>}

      {shown.length === 0 ? (
        <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">
          {orders.length === 0 ? 'No orders yet. Share your store link to get your first one.' : 'No orders in this view.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {shown.map((o) => {
            const chat = waLink(o.buyer_phone, `Hello ${o.buyer_name.split(' ')[0]}, this is ${site.name} about your order ${o.order_code}.`);
            return (
              <li key={o.id} className="g-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{o.order_code} <span className="text-secondary font-normal">· {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></p>
                    <p className="text-sm text-secondary mt-0.5">{o.buyer_name} · {o.buyer_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMoney(o.total_amount, site.currency)}</p>
                    <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-medium ${PAY_TONE[o.payment_status]}`}>{PAY_LABEL[o.payment_status]}</span>
                  </div>
                </div>

                <ul className="mt-3 text-sm text-secondary space-y-0.5">
                  {o.items.map((i, idx) => <li key={idx}>{i.qty} × {i.title} <span className="opacity-70">({formatMoney(i.price, site.currency)})</span></li>)}
                </ul>

                <div className="mt-3 text-sm space-y-1">
                  <p className="text-secondary">
                    {o.payment_method === 'manual_transfer' ? 'Bank transfer' : 'Pay on delivery'}
                    {o.payment_reference && <> · reference <span className="font-mono text-primary">{o.payment_reference}</span></>}
                  </p>
                  {o.payment_proof_note && <p className="text-secondary">Note: {o.payment_proof_note}</p>}
                  {o.internal_note && <p className="text-xs px-3 py-1.5 rounded-lg bg-secondary/40 text-primary">Private note: {o.internal_note}</p>}
                  {Number(o.refunded_amount || 0) > 0 && (
                    <p className="text-xs text-warning font-medium">Refunded: {formatMoney(Number(o.refunded_amount), site.currency)}</p>
                  )}
                  {o.delivery_method === 'pickup' ? (
                    <p className="text-secondary">Store pickup selected</p>
                  ) : (
                    (o.delivery_address || o.delivery_state || Number(o.shipping_fee || 0) > 0) && (
                      <p className="text-secondary">
                        Deliver{o.delivery_state ? ` (${o.delivery_state}${o.shipping_zone ? ` · ${o.shipping_zone}` : ''})` : ''}
                        {o.delivery_address ? `: ${o.delivery_address}` : ''}
                        {Number(o.shipping_fee || 0) > 0 ? ` · Fee: ${formatMoney(Number(o.shipping_fee), site.currency)}` : ''}
                      </p>
                    )
                  )}
                  {o.notes && <p className="text-secondary">Buyer note: {o.notes}</p>}
                  <p className="flex flex-wrap gap-x-4">
                    {o.buyer_phone && <span className="text-secondary">{o.buyer_phone}</span>}
                    {chat && <a href={chat} target="_blank" rel="noopener noreferrer" className="text-accent font-medium hover:underline">Message on WhatsApp</a>}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-theme">
                  {o.payment_status !== 'paid' && (
                    <button disabled={busyId === o.id} onClick={() => patch(o, { payment_status: 'paid' })} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-sm font-medium px-4 h-9 rounded-full disabled:opacity-50">
                      Mark as paid
                    </button>
                  )}
                  {o.payment_status !== 'rejected' && o.payment_status !== 'paid' && (
                    <button disabled={busyId === o.id} onClick={() => patch(o, { payment_status: 'rejected' })} className="text-sm px-4 h-9 rounded-full border border-theme text-danger disabled:opacity-50">
                      Reject payment
                    </button>
                  )}
                  {planFor(site.plan_tier, site.plan_expires_at).receipts && (
                    <a
                      href={`/receipt/${encodeURIComponent(o.order_code)}?slug=${encodeURIComponent(site.slug)}&email=${encodeURIComponent(o.buyer_email)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm px-4 h-9 rounded-full border border-theme hover:bg-hover inline-flex items-center text-primary"
                    >
                      Receipt
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setNoteOpenId(noteOpenId === o.id ? null : o.id);
                      setNoteDrafts((d) => ({ ...d, [o.id]: d[o.id] ?? (o.internal_note || '') }));
                    }}
                    className="text-sm px-4 h-9 rounded-full border border-theme hover:bg-hover text-primary"
                  >
                    Private note
                  </button>
                  {plan.refundsLog && (
                    <button
                      type="button"
                      onClick={() => setRefundOrder(o)}
                      className="text-sm px-4 h-9 rounded-full border border-theme hover:bg-hover text-primary"
                    >
                      Refund / Return
                    </button>
                  )}
                  <label className="text-sm text-secondary ml-auto flex items-center gap-2">
                    Delivery
                    <select
                      value={o.fulfillment_status}
                      disabled={busyId === o.id}
                      onChange={(e) => patch(o, { fulfillment_status: e.target.value as SiteOrder['fulfillment_status'] })}
                      className="input-box !py-1.5 !px-3 text-sm"
                    >
                      <option value="pending">Not started</option>
                      <option value="processing">Preparing</option>
                      <option value="shipped">Sent out</option>
                      <option value="completed">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                </div>
                {noteOpenId === o.id && (
                  <div className="mt-3 pt-3 border-t border-theme flex flex-wrap gap-2">
                    <input
                      value={noteDrafts[o.id] ?? ''}
                      onChange={(e) => setNoteDrafts((d) => ({ ...d, [o.id]: e.target.value }))}
                      placeholder="Private staff note (never shown to the buyer)"
                      maxLength={1000}
                      className="input-box flex-1 min-w-[200px] text-sm"
                    />
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={async () => { await patch(o, { internal_note: noteDrafts[o.id] ?? '' }); setNoteOpenId(null); }}
                      className="h-9 px-4 rounded-full bg-accent text-[var(--accent-foreground)] text-xs font-medium disabled:opacity-50"
                    >
                      Save note
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {refundOrder && (
        <OrderRefundModal
          site={site}
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onDone={reload}
        />
      )}
    </div>
  );
}
