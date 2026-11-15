'use client';

import { useCallback, useEffect, useState } from 'react';
import { PLANS, effectiveTier } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');

interface Slot { id: string; name: string; placement: 'banner' | 'sidebar' | 'footer'; price_ngn: number; days: number; description: string; is_active: boolean }
interface Booking { id: string; slot_id: string; advertiser_name: string; advertiser_email: string; advertiser_phone: string; title: string; link_url: string; image_url: string; reference: string; status: 'pending' | 'approved' | 'rejected' | 'expired'; starts_at: string | null; ends_at: string | null; created_at: string }

const EMPTY = { name: '', placement: 'banner' as Slot['placement'], price_ngn: 5000, days: 30, description: '' };

export default function AdSpaceTab({ site, goToPlan }: { site: Site; goToPlan: () => void }) {
  const allowed = PLANS[effectiveTier(site.plan_tier, site.plan_expires_at)].adSpace;
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [houseForm, setHouseForm] = useState({ slot_id: '', title: '', link_url: '', image_url: '', days: 30 });
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/forums/${site.slug}/ad-space/manage`;

  const load = useCallback(async () => {
    const r = await jsonFetch<{ slots?: Slot[]; bookings?: Booking[] }>(base);
    if (r.ok) { setSlots(r.data.slots || []); setBookings(r.data.bookings || []); }
  }, [base]);
  useEffect(() => { if (allowed) { Promise.resolve().then(load); } }, [allowed, load]);

  if (!allowed) {
    return (
      <div className="g-tonal p-6 max-w-xl">
        <h3 className="g-h3">Run ads or sell ad space on your site</h3>
        <p className="text-sm text-secondary mt-2">Free accounts cannot run ads. Upgrade to Student/Lite or higher to place your own promo banners on your site or sell banner slots to businesses.</p>
        <button onClick={goToPlan} className="mt-4 bg-accent text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full">See plans</button>
      </div>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await jsonFetch(base, { method: 'PUT', body: { ...form, ...(editing ? { id: editing } : {}), price_ngn: Number(form.price_ngn), days: Number(form.days) } });
    setBusy(false);
    if (r.ok) { setForm(EMPTY); setEditing(null); setMsg({ ok: true, text: 'Slot saved. It now shows on your site as "Advertise here".' }); load(); }
    else setMsg({ ok: false, text: r.data.error || 'Could not save.' });
  };
  const toggle = async (s: Slot) => { await jsonFetch(base, { method: 'PUT', body: { ...s, is_active: !s.is_active } }); load(); };
  const remove = async (s: Slot) => { if (confirm(`Delete "${s.name}"?`)) { await jsonFetch(`${base}?id=${s.id}`, { method: 'DELETE' }); load(); } };
  const decide = async (b: Booking, status: 'approved' | 'rejected') => {
    const r = await jsonFetch(base, { method: 'PATCH', body: { id: b.id, status } });
    setMsg({ ok: r.ok, text: r.ok ? (status === 'approved' ? 'Approved. The ad is live and the advertiser has been emailed.' : 'Rejected.') : r.data.error || 'Could not update.' });
    load();
  };
  const slotName = (id: string) => slots.find((s) => s.id === id)?.name || 'Slot';
  const pending = bookings.filter((b) => b.status === 'pending');

  return (
    <div className="space-y-6">
      {msg && <p role="status" className={`text-sm rounded-xl p-3 border ${msg.ok ? 'text-success border-success/30' : 'text-danger border-danger/30'}`}>{msg.text}</p>}

      {pending.length > 0 && (
        <section className="g-card p-5">
          <h3 className="font-medium mb-3">Waiting for you ({pending.length})</h3>
          <ul className="divide-y divide-theme">
            {pending.map((b) => (
              <li key={b.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{b.title} <span className="text-secondary font-normal">· {slotName(b.slot_id)} · {b.reference}</span></p>
                  <p className="text-secondary">{b.advertiser_name} · {b.advertiser_email}{b.advertiser_phone ? ` · ${b.advertiser_phone}` : ''}</p>
                  {b.image_url && <a href={b.image_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">View banner</a>}
                  {b.link_url && <> <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline ml-2">Check link</a></>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => decide(b, 'approved')} className="bg-accent text-[var(--accent-foreground)] px-5 h-10 rounded-full text-sm font-medium">I received payment, approve</button>
                  <button onClick={() => decide(b, 'rejected')} className="border border-theme px-5 h-10 rounded-full text-sm">Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="g-card p-5">
        <h3 className="font-medium">Your ad slots</h3>
        <p className="text-sm text-secondary mt-1">Advertisers see these on your site, pay you by bank transfer, and you approve the ad once the money is in.</p>
        {slots.length === 0 ? <p className="text-sm text-secondary mt-4">No slots yet. Add your first below.</p> : (
          <ul className="mt-4 divide-y divide-theme">
            {slots.map((s) => (
              <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{s.name} <span className="text-secondary font-normal capitalize">· {s.placement}</span></p>
                  <p className="text-secondary">{naira(s.price_ngn)} for {s.days} days{s.description ? ` · ${s.description}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditing(s.id); setForm({ name: s.name, placement: s.placement, price_ngn: s.price_ngn, days: s.days, description: s.description }); }} className="px-4 h-9 rounded-full border border-theme text-xs">Edit</button>
                  <button onClick={() => toggle(s)} className="px-4 h-9 rounded-full border border-theme text-xs">{s.is_active ? 'Pause' : 'Resume'}</button>
                  <button onClick={() => remove(s)} className="px-4 h-9 rounded-full border border-theme text-xs text-danger">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={save} className="mt-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="text-xs font-medium lg:col-span-2">Name
            <input required minLength={2} maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Top banner" className="input-box w-full mt-1 text-sm" />
          </label>
          <label className="text-xs font-medium">Where
            <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value as Slot['placement'] })} className="input-box w-full mt-1 text-sm">
              <option value="banner">Top banner</option><option value="sidebar">Sidebar</option><option value="footer">Footer</option>
            </select>
          </label>
          <label className="text-xs font-medium">Price (₦)
            <input type="number" min={0} required value={form.price_ngn} onChange={(e) => setForm({ ...form, price_ngn: Number(e.target.value) })} className="input-box w-full mt-1 text-sm" />
          </label>
          <label className="text-xs font-medium">Days
            <input type="number" min={1} max={365} required value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} className="input-box w-full mt-1 text-sm" />
          </label>
          <label className="text-xs font-medium sm:col-span-2 lg:col-span-4">Short note for advertisers (optional)
            <input maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Seen by about 2,000 visitors a week" className="input-box w-full mt-1 text-sm" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="bg-accent text-[var(--accent-foreground)] px-6 h-11 rounded-full text-sm font-medium disabled:opacity-50">{editing ? 'Save changes' : 'Add slot'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="px-4 h-11 rounded-full border border-theme text-sm">Cancel</button>}
          </div>
        </form>
      </section>

      {slots.length > 0 && (
        <section className="g-card p-5">
          <h3 className="font-medium">Run your own ad on this site</h3>
          <p className="text-sm text-secondary mt-1">Promote your own products, events or links in any of your active slots above—free of charge, on your own site only.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true); setMsg(null);
              const targetSlot = houseForm.slot_id || slots[0]?.id;
              const r = await jsonFetch(base, { method: 'POST', body: { ...houseForm, slot_id: targetSlot, days: Number(houseForm.days) } });
              setBusy(false);
              if (r.ok) {
                setHouseForm({ slot_id: '', title: '', link_url: '', image_url: '', days: 30 });
                setMsg({ ok: true, text: 'Your house ad is now live on your site.' });
                load();
              } else {
                setMsg({ ok: false, text: r.data.error || 'Could not publish ad.' });
              }
            }}
            className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
          >
            <label className="text-xs font-medium">Slot
              <select value={houseForm.slot_id || slots[0]?.id || ''} onChange={(e) => setHouseForm({ ...houseForm, slot_id: e.target.value })} className="input-box w-full mt-1 text-sm">
                {slots.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.placement})</option>)}
              </select>
            </label>
            <label className="text-xs font-medium lg:col-span-2">Ad headline
              <input required minLength={2} maxLength={100} value={houseForm.title} onChange={(e) => setHouseForm({ ...houseForm, title: e.target.value })} placeholder="Weekend 20% off sale" className="input-box w-full mt-1 text-sm" />
            </label>
            <label className="text-xs font-medium">Link URL (optional)
              <input type="url" value={houseForm.link_url} onChange={(e) => setHouseForm({ ...houseForm, link_url: e.target.value })} placeholder="https://..." className="input-box w-full mt-1 text-sm" />
            </label>
            <label className="text-xs font-medium">Days
              <input type="number" min={1} max={365} required value={houseForm.days} onChange={(e) => setHouseForm({ ...houseForm, days: Number(e.target.value) })} className="input-box w-full mt-1 text-sm" />
            </label>
            <label className="text-xs font-medium sm:col-span-2 lg:col-span-4">Banner image HTTPS URL (optional)
              <input type="url" value={houseForm.image_url} onChange={(e) => setHouseForm({ ...houseForm, image_url: e.target.value })} placeholder="https://..." className="input-box w-full mt-1 text-sm" />
            </label>
            <div>
              <button type="submit" disabled={busy} className="bg-accent text-[var(--accent-foreground)] px-6 h-11 rounded-full text-sm font-medium disabled:opacity-50">Publish ad</button>
            </div>
          </form>
        </section>
      )}

      {bookings.filter((b) => b.status !== 'pending').length > 0 && (
        <section className="g-card p-5">
          <h3 className="font-medium mb-3">History</h3>
          <ul className="divide-y divide-theme text-sm">
            {bookings.filter((b) => b.status !== 'pending').map((b) => (
              <li key={b.id} className="py-2.5 flex flex-wrap justify-between gap-2">
                <span>{b.title} <span className="text-secondary">· {b.advertiser_name}</span></span>
                <span className="text-secondary capitalize">{b.status}{b.ends_at && b.status === 'approved' ? ` until ${new Date(b.ends_at).toLocaleDateString('en-GB')}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
