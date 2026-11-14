'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';

interface TierRow {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  is_active: boolean;
}

interface MembershipRow {
  id: string;
  tier_id: string;
  member_name: string;
  email: string;
  status: 'pending' | 'active' | 'expired' | 'rejected';
  payment_reference: string;
  expires_at: string | null;
  created_at: string;
}

export default function MembershipsTab({ site, goToPlan }: { site: Site; goToPlan: () => void }) {
  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await jsonFetch<{ tiers?: TierRow[]; memberships?: MembershipRow[] }>(`/api/forums/${site.slug}/memberships`);
    setTiers(r.data.tiers || []);
    setMemberships(r.data.memberships || []);
    setLoading(false);
  }, [site.slug]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (active) await load();
    })();
    return () => { active = false; };
  }, [load]);

  const createTier = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const r = await jsonFetch(`/api/forums/${site.slug}/memberships`, {
      method: 'POST',
      body: {
        action: 'create_tier',
        name,
        description,
        price: Number(price || 0),
        duration_days: Number(durationDays || 30),
      },
    });
    if (r.ok) {
      setName('');
      setDescription('');
      setPrice('');
      setDurationDays('30');
      await load();
    } else {
      setMsg(r.data.error || 'Could not create tier.');
    }
    setBusy(false);
  };

  const toggleTier = async (t: TierRow) => {
    await jsonFetch(`/api/forums/${site.slug}/memberships`, {
      method: 'PATCH',
      body: { tier_id: t.id, is_active: !t.is_active },
    });
    await load();
  };

  const setStatus = async (id: string, status: MembershipRow['status']) => {
    await jsonFetch(`/api/forums/${site.slug}/memberships`, {
      method: 'PATCH',
      body: { id, status },
    });
    await load();
  };

  if (!plan.paidMemberships) {
    return (
      <div className="g-card p-6 max-w-lg space-y-3">
        <h3 className="font-medium">Paid community memberships</h3>
        <p className="text-sm text-secondary">Create monthly or yearly membership tiers and gate exclusive community discussions on the Business plan.</p>
        <button type="button" onClick={goToPlan} className="px-5 h-10 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-medium">
          Upgrade to Business
        </button>
      </div>
    );
  }

  const tierNames = new Map(tiers.map((t) => [t.id, t.name]));

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <form onSubmit={createTier} className="lg:col-span-2 g-card p-5 space-y-4 h-fit">
        <h3 className="font-medium">Create membership tier</h3>
        <div>
          <label htmlFor="m-name" className="block text-sm font-medium mb-1">Tier name</label>
          <input id="m-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Inner Circle" className="input-box w-full" />
        </div>
        <div>
          <label htmlFor="m-desc" className="block text-sm font-medium mb-1">What members get</label>
          <textarea id="m-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Weekly live Q&A, members-only threads, early drops" className="input-box w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="m-price" className="block text-sm font-medium mb-1">Price ({site.currency})</label>
            <input id="m-price" type="number" min={0} required value={price} onChange={(e) => setPrice(e.target.value)} className="input-box w-full" />
          </div>
          <div>
            <label htmlFor="m-days" className="block text-sm font-medium mb-1">Duration (days)</label>
            <input id="m-days" type="number" min={1} max={3650} required value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="input-box w-full" />
          </div>
        </div>
        {msg && <p className="text-sm text-danger" role="alert">{msg}</p>}
        <button type="submit" disabled={busy} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-sm font-medium px-6 h-11 rounded-full disabled:opacity-50">
          {busy ? 'Creating…' : 'Create tier'}
        </button>
      </form>

      <div className="lg:col-span-3 space-y-6">
        <section className="g-card p-5 space-y-3">
          <h3 className="font-medium">Membership tiers ({tiers.length})</h3>
          {loading ? (
            <p className="text-sm text-secondary">Loading…</p>
          ) : tiers.length === 0 ? (
            <p className="text-sm text-secondary">No tiers yet. Add one on the left so visitors can subscribe.</p>
          ) : (
            <div className="divide-y divide-theme">
              {tiers.map((t) => (
                <div key={t.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{t.name} {!t.is_active && <span className="text-xs text-secondary">(paused)</span>}</p>
                    <p className="text-xs text-secondary">{formatMoney(t.price, site.currency)} · every {t.duration_days} days</p>
                  </div>
                  <button type="button" onClick={() => toggleTier(t)} className="px-3.5 h-9 rounded-full border border-theme hover:bg-hover text-xs font-medium">
                    {t.is_active ? 'Pause' : 'Resume'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="g-card p-5 space-y-3">
          <h3 className="font-medium">Member requests & renewals ({memberships.length})</h3>
          {memberships.length === 0 ? (
            <p className="text-sm text-secondary">No membership signups yet.</p>
          ) : (
            <div className="divide-y divide-theme">
              {memberships.map((m) => (
                <div key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.member_name} · {tierNames.get(m.tier_id) || 'Tier'}</p>
                    <p className="text-xs text-secondary">
                      Status: <strong className="capitalize">{m.status}</strong>
                      {m.payment_reference && ` · Ref: ${m.payment_reference}`}
                      {m.expires_at && ` · Ends ${new Date(m.expires_at).toLocaleDateString('en-GB')}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {m.status !== 'active' && (
                      <button type="button" onClick={() => setStatus(m.id, 'active')} className="px-3.5 h-9 rounded-full bg-accent text-[var(--accent-foreground)] text-xs font-medium">
                        Activate
                      </button>
                    )}
                    {m.status === 'pending' && (
                      <button type="button" onClick={() => setStatus(m.id, 'rejected')} className="px-3.5 h-9 rounded-full border border-theme text-xs text-danger">
                        Reject
                      </button>
                    )}
                    {m.status === 'active' && (
                      <button type="button" onClick={() => setStatus(m.id, 'expired')} className="px-3.5 h-9 rounded-full border border-theme text-xs">
                        Expire
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
