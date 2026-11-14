'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatMoney, type SiteOrder, type SiteOrderEvent } from '@/lib/forums';
import { jsonFetch, type Site } from '../types';

export default function OrderRefundModal({
  site,
  order,
  onClose,
  onDone,
}: {
  site: Site;
  order: SiteOrder;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [events, setEvents] = useState<SiteOrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<'refund' | 'return'>('refund');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [stockReturned, setStockReturned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/forums/${encodeURIComponent(site.slug)}/orders/${order.id}/events`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (active) setEvents(d.events || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [site.slug, order.id]);

  const remaining = Math.max(0, Number(order.total_amount) - Number(order.refunded_amount || 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const amt = Number(amount || 0);
    if (!Number.isFinite(amt) || amt < 0 || amt > remaining) {
      setError(`Amount must be between 0 and ${formatMoney(remaining, site.currency)}.`);
      setBusy(false);
      return;
    }
    const r = await jsonFetch(`/api/forums/${site.slug}/orders/${order.id}/events`, {
      method: 'POST',
      body: { kind, amount: amt, note: note.trim(), stock_returned: stockReturned },
    });
    if (!r.ok) {
      setError(r.data.error || 'Could not record refund.');
      setBusy(false);
      return;
    }
    await onDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="g-card p-6 w-full max-w-lg max-h-[88vh] overflow-y-auto space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-theme pb-3">
          <div>
            <h3 className="g-h3">Refund / Return · {order.order_code}</h3>
            <p className="text-xs text-secondary mt-0.5">
              Total: {formatMoney(order.total_amount, site.currency)} · Remaining refundable: {formatMoney(remaining, site.currency)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            {(['refund', 'return'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`h-10 rounded-xl border text-xs font-medium capitalize ${
                  kind === k ? 'bg-accent text-[var(--accent-foreground)] border-accent' : 'border-theme text-secondary'
                }`}
              >
                Log {k}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Refund amount ({site.currency || 'NGN'})</label>
            <input
              type="number"
              min="0"
              max={remaining}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to ${remaining}`}
              className="input-box w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Reason / reference</label>
            <textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Size exchanged or refunded via GTB transfer"
              className="input-box w-full text-sm"
            />
          </div>
          <label className="flex items-center gap-2.5 text-xs text-secondary cursor-pointer">
            <input type="checkbox" checked={stockReturned} onChange={(e) => setStockReturned(e.target.checked)} className="w-4 h-4" />
            Add items back into inventory stock
          </label>
          {error && <p className="text-xs text-danger" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </form>

        <div className="pt-3 border-t border-theme space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-secondary">History</h4>
          {loading ? (
            <p className="text-xs text-secondary">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-secondary">No refund or return entries yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {events.map((ev) => (
                <li key={ev.id} className="p-2.5 rounded-xl bg-secondary/30 border border-theme flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold capitalize">{ev.kind}{ev.stock_returned ? ' · stock returned' : ''}</p>
                    {ev.note && <p className="text-secondary">{ev.note}</p>}
                  </div>
                  <span className="font-mono shrink-0">{formatMoney(ev.amount, site.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
