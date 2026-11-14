'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { NIGERIAN_STATES, type ShippingZoneRow } from '@/lib/shipping';
import { planFor } from '@/lib/plans';
import { formatMoney } from '@/lib/forums';
import { jsonFetch, type Site } from '../types';

interface EditableZone {
  localId: string;
  name: string;
  states: string[];
  fee: string;
  free_over: string;
  is_active: boolean;
}

const PRESETS: { name: string; states: string[]; fee: string; free_over: string }[] = [
  { name: 'Lagos', states: ['Lagos'], fee: '2500', free_over: '50000' },
  { name: 'South-West & Abuja', states: ['FCT Abuja', 'Ogun', 'Oyo', 'Ondo', 'Osun', 'Ekiti'], fee: '4000', free_over: '80000' },
  { name: 'Rest of Nigeria', states: ['Other'], fee: '5500', free_over: '' },
];

export default function ShippingTab({
  site,
  reload,
  goToPlan,
}: {
  site: Site;
  reload: () => Promise<void>;
  goToPlan: () => void;
}) {
  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const [zones, setZones] = useState<EditableZone[]>([]);
  const [pickupAddress, setPickupAddress] = useState(site.pickup_address || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const r = await jsonFetch<{ zones?: ShippingZoneRow[]; pickup_address?: string }>(`/api/forums/${site.slug}/shipping`);
      if (!active) return;
      if (r.ok) {
        const list = r.data.zones || [];
        setZones(
          list.map((z) => ({
            localId: z.id || Math.random().toString(36).slice(2),
            name: z.name,
            states: z.states || [],
            fee: String(z.fee ?? 0),
            free_over: z.free_over !== null && z.free_over !== undefined ? String(z.free_over) : '',
            is_active: z.is_active !== false,
          }))
        );
        if (r.data.pickup_address !== undefined) setPickupAddress(r.data.pickup_address);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [site.slug]);

  const addZone = (preset?: (typeof PRESETS)[number]) => {
    setZones((prev) => [
      ...prev,
      {
        localId: Math.random().toString(36).slice(2),
        name: preset?.name || '',
        states: preset?.states || [],
        fee: preset?.fee || '2500',
        free_over: preset?.free_over || '',
        is_active: true,
      },
    ]);
  };

  const toggleState = (localId: string, stateName: string) => {
    setZones((prev) =>
      prev.map((z) => {
        if (z.localId !== localId) return z;
        const exists = z.states.includes(stateName);
        return { ...z, states: exists ? z.states.filter((s) => s !== stateName) : [...z.states, stateName] };
      })
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const payload = {
      pickup_address: pickupAddress.trim(),
      zones: zones
        .filter((z) => z.name.trim())
        .map((z) => ({
          name: z.name.trim(),
          states: z.states,
          fee: Math.max(0, Number(z.fee) || 0),
          free_over: z.free_over.trim() ? Math.max(0, Number(z.free_over) || 0) : null,
          is_active: z.is_active,
        })),
    };
    const r = await jsonFetch(`/api/forums/${site.slug}/shipping`, { method: 'PUT', body: payload });
    if (r.ok) {
      setMsg({ ok: true, text: 'Delivery settings saved.' });
      await reload();
    } else {
      setMsg({ ok: false, text: r.data.error || 'Could not save delivery settings.' });
    }
    setSaving(false);
  };

  if (!plan.shippingZones) {
    return (
      <div className="g-card p-6 space-y-3">
        <h3 className="g-h3">Delivery fees & pickup</h3>
        <p className="text-sm text-secondary">
          Charge automatic delivery fees by state, offer free shipping above an order amount, and let local buyers choose store pickup on Pro and Business plans.
        </p>
        <button type="button" onClick={goToPlan} className="bg-accent text-[var(--accent-foreground)] text-sm font-medium px-5 h-10 rounded-full">
          Upgrade to Pro
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-6 max-w-3xl">
      <section className="g-card p-6 space-y-3">
        <h3 className="font-medium">Store pickup</h3>
        <p className="text-sm text-secondary">Leave blank if you only deliver. Filling this in gives buyers a free Store Pickup option at checkout.</p>
        <input
          value={pickupAddress}
          onChange={(e) => setPickupAddress(e.target.value)}
          placeholder="e.g. Suite 12, Lekki Mall, Admiralty Way, Lagos (Mon-Sat 9am-6pm)"
          maxLength={400}
          className="input-box w-full"
        />
      </section>

      <section className="g-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-medium">Delivery zones by state</h3>
            <p className="text-sm text-secondary">Add zones for Lagos, Abuja, or nationwide delivery ({site.currency || 'NGN'}).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {zones.length === 0 && (
              <button
                type="button"
                onClick={() => setZones(PRESETS.map((p) => ({ localId: Math.random().toString(36).slice(2), ...p, is_active: true })))}
                className="min-h-9 px-3.5 rounded-full border border-theme hover:bg-hover text-xs font-medium"
              >
                Use Nigerian starter zones
              </button>
            )}
            <button
              type="button"
              onClick={() => addZone()}
              className="min-h-9 px-3.5 rounded-full bg-accent text-[var(--accent-foreground)] text-xs font-medium inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add zone
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-secondary">Loading zones…</p>
        ) : zones.length === 0 ? (
          <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-6 text-center">
            No delivery zones added yet. Delivery fee defaults to {formatMoney(0, site.currency)}.
          </p>
        ) : (
          <div className="space-y-4">
            {zones.map((z) => (
              <div key={z.localId} className="p-4 rounded-2xl border border-theme bg-secondary/20 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    required
                    value={z.name}
                    onChange={(e) => setZones((prev) => prev.map((x) => (x.localId === z.localId ? { ...x, name: e.target.value } : x)))}
                    placeholder="Zone name (e.g. Lagos Island)"
                    className="input-box flex-1 min-w-[160px] text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={z.fee}
                    onChange={(e) => setZones((prev) => prev.map((x) => (x.localId === z.localId ? { ...x, fee: e.target.value } : x)))}
                    placeholder="Fee"
                    aria-label="Delivery fee"
                    className="input-box w-32 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={z.free_over}
                    onChange={(e) => setZones((prev) => prev.map((x) => (x.localId === z.localId ? { ...x, free_over: e.target.value } : x)))}
                    placeholder="Free over (optional)"
                    aria-label="Free delivery above amount"
                    className="input-box w-44 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setZones((prev) => prev.filter((x) => x.localId !== z.localId))}
                    aria-label="Remove zone"
                    className="w-10 h-10 rounded-full hover:bg-hover text-danger flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-secondary">
                    <span>States covered ({z.states.length || 0} selected — choose &quot;Other&quot; for any remaining state)</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={z.is_active}
                        onChange={(e) => setZones((prev) => prev.map((x) => (x.localId === z.localId ? { ...x, is_active: e.target.checked } : x)))}
                      />
                      Active
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-primary border border-theme">
                    {['Other', ...NIGERIAN_STATES].map((st) => {
                      const picked = z.states.includes(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => toggleState(z.localId, st)}
                          className={`px-2.5 py-1 rounded-full text-xs border transition cursor-pointer ${
                            picked ? 'bg-accent text-[var(--accent-foreground)] border-accent' : 'border-theme text-secondary hover:text-primary'
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={saving} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-sm font-medium px-7 h-11 rounded-full disabled:opacity-50">
          {saving ? 'Saving…' : 'Save delivery setup'}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`} role="status">{msg.text}</p>}
      </div>
    </form>
  );
}
