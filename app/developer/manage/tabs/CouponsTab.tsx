'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';

interface Coupon { id: string; code: string; kind: 'percent' | 'fixed'; amount: number; max_uses: number | null; used_count: number; expires_at: string | null; is_active: boolean }

export default function CouponsTab({ site, goToPlan }: { site: Site; goToPlan: () => void }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [form, setForm] = useState({ code: '', kind: 'percent', amount: '', max_uses: '', expires: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const allowed = planFor(site.plan_tier, site.plan_expires_at).coupons;

  const load = useCallback(async () => {
    const r = await jsonFetch<{ coupons?: Coupon[]; needs_update?: boolean }>(`/api/forums/${site.slug}/coupons`);
    setCoupons(r.data.coupons || []);
    setNeedsUpdate(!!r.data.needs_update);
  }, [site.slug]);
  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await jsonFetch(`/api/forums/${site.slug}/coupons`, {
      method: 'POST',
      body: {
        code: form.code,
        kind: form.kind,
        amount: Number(form.amount),
        max_uses: form.max_uses === '' ? null : Number(form.max_uses),
        expires_at: form.expires ? new Date(form.expires + 'T23:59:59').toISOString() : null,
      },
    });
    if (r.ok) { setForm({ code: '', kind: 'percent', amount: '', max_uses: '', expires: '' }); await load(); }
    else setError(r.data.error || 'Could not create the coupon.');
    setBusy(false);
  };

  const toggle = async (c: Coupon) => { await jsonFetch(`/api/forums/${site.slug}/coupons/${c.id}`, { method: 'PATCH', body: { is_active: !c.is_active } }); await load(); };
  const remove = async (c: Coupon) => { if (!confirm(`Delete coupon ${c.code}?`)) return; await jsonFetch(`/api/forums/${site.slug}/coupons/${c.id}`, { method: 'DELETE' }); await load(); };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <form onSubmit={create} className="lg:col-span-2 g-card p-5 space-y-4 h-fit">
        <h3 className="font-medium">New coupon</h3>
        {!allowed && (
          <p className="text-sm text-secondary">
            Discount coupons are part of the Pro plan.{' '}
            <button type="button" onClick={goToPlan} className="text-accent font-medium hover:underline">See plans</button>
          </p>
        )}
        {needsUpdate && <p className="text-sm text-warning">Coupons need the latest database update before they can be used.</p>}
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="c-code">Code</label>
          <input id="c-code" required disabled={!allowed} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" className="input-box w-full font-mono" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="c-kind">Type</label>
            <select id="c-kind" disabled={!allowed} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="input-box w-full">
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="c-amt">{form.kind === 'percent' ? 'Percent' : 'Amount'}</label>
            <input id="c-amt" type="number" min={1} max={form.kind === 'percent' ? 100 : undefined} required disabled={!allowed} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-box w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="c-max">Max uses <span className="text-secondary font-normal">(optional)</span></label>
            <input id="c-max" type="number" min={1} disabled={!allowed} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="input-box w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="c-exp">Ends <span className="text-secondary font-normal">(optional)</span></label>
            <input id="c-exp" type="date" disabled={!allowed} value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} className="input-box w-full" />
          </div>
        </div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !allowed} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full disabled:opacity-50">
          {busy ? 'Creating…' : 'Create coupon'}
        </button>
      </form>

      <div className="lg:col-span-3 space-y-3">
        {coupons.length === 0 && <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">No coupons yet. Buyers can type a code at checkout to get a discount.</p>}
        {coupons.map((c) => (
          <div key={c.id} className="g-card p-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono font-medium">{c.code} {!c.is_active && <span className="text-secondary font-sans font-normal">· off</span>}</p>
              <p className="text-sm text-secondary">
                {c.kind === 'percent' ? `${c.amount}% off` : `${formatMoney(c.amount, site.currency)} off`}
                {' · '}used {c.used_count}{c.max_uses ? ` of ${c.max_uses}` : ''}
                {c.expires_at && ` · ends ${new Date(c.expires_at).toLocaleDateString('en-GB')}`}
              </p>
            </div>
            <div className="flex gap-1 text-sm">
              <button onClick={() => toggle(c)} className="px-3 h-9 rounded-full hover:bg-hover">{c.is_active ? 'Turn off' : 'Turn on'}</button>
              <button onClick={() => remove(c)} className="px-3 h-9 rounded-full hover:bg-hover text-danger">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
