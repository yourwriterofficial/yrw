'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface BookingService {
  id: string;
  title: string;
  description: string;
  duration_mins: number;
  price: number;
  slot_days: string[];
  slot_hours: string[];
  is_active: boolean;
}

interface BookingRow {
  id: string;
  service_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  slot_date: string;
  slot_time: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}

export default function BookingsTab({ site, goToPlan }: { site: Site; goToPlan: () => void }) {
  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const canCreate = !site.my_role || site.my_role === 'owner' || site.my_role === 'manager';

  const [services, setServices] = useState<BookingService[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMins, setDurationMins] = useState('45');
  const [price, setPrice] = useState('');
  const [days, setDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [hoursText, setHoursText] = useState('09:00, 11:00, 14:00, 16:00');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await jsonFetch<{ services?: BookingService[]; bookings?: BookingRow[] }>(`/api/forums/${site.slug}/bookings`);
    setServices(r.data.services || []);
    setBookings(r.data.bookings || []);
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

  const toggleDay = (d: string) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const createService = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const slot_hours = hoursText.split(',').map((h) => h.trim()).filter(Boolean);
    const r = await jsonFetch(`/api/forums/${site.slug}/bookings`, {
      method: 'POST',
      body: {
        action: 'create_service',
        title,
        description,
        duration_mins: Number(durationMins || 30),
        price: Number(price || 0),
        slot_days: days.length > 0 ? days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        slot_hours: slot_hours.length > 0 ? slot_hours : ['09:00', '14:00'],
      },
    });
    if (r.ok) {
      setTitle('');
      setDescription('');
      setPrice('');
      await load();
    } else {
      setMsg(r.data.error || 'Could not create service.');
    }
    setBusy(false);
  };

  const toggleService = async (s: BookingService) => {
    await jsonFetch(`/api/forums/${site.slug}/bookings`, {
      method: 'PATCH',
      body: { service_id: s.id, is_active: !s.is_active },
    });
    await load();
  };

  const updateStatus = async (id: string, status: BookingRow['status']) => {
    await jsonFetch(`/api/forums/${site.slug}/bookings`, {
      method: 'PATCH',
      body: { id, status },
    });
    await load();
  };

  if (!plan.bookings) {
    return (
      <div className="g-card p-6 max-w-lg space-y-3">
        <h3 className="font-medium">Appointment & service bookings</h3>
        <p className="text-sm text-secondary">Let clients pick open time slots for consultations, fittings, or salon sessions on the Business plan.</p>
        <button type="button" onClick={goToPlan} className="px-5 h-10 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-medium">
          Upgrade to Business
        </button>
      </div>
    );
  }

  const svcNames = new Map(services.map((s) => [s.id, s.title]));

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {canCreate && (
        <form onSubmit={createService} className="lg:col-span-2 g-card p-5 space-y-4 h-fit">
          <h3 className="font-medium">Add bookable service</h3>
          <div>
            <label htmlFor="bk-title" className="block text-sm font-medium mb-1">Service title</label>
            <input id="bk-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bespoke fitting" className="input-box w-full" />
          </div>
          <div>
            <label htmlFor="bk-desc" className="block text-sm font-medium mb-1">Description</label>
            <textarea id="bk-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="In-studio measurement and style consultation" className="input-box w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bk-dur" className="block text-sm font-medium mb-1">Duration (mins)</label>
              <input id="bk-dur" type="number" min={5} max={480} required value={durationMins} onChange={(e) => setDurationMins(e.target.value)} className="input-box w-full" />
            </div>
            <div>
              <label htmlFor="bk-price" className="block text-sm font-medium mb-1">Fee ({site.currency})</label>
              <input id="bk-price" type="number" min={0} required value={price} onChange={(e) => setPrice(e.target.value)} className="input-box w-full" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-1.5">Available days</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`px-3 h-9 rounded-full text-xs font-medium border ${days.includes(d) ? 'bg-accent text-[var(--accent-foreground)] border-accent' : 'border-theme text-secondary'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="bk-hrs" className="block text-sm font-medium mb-1">Time slots (comma-separated)</label>
            <input id="bk-hrs" required value={hoursText} onChange={(e) => setHoursText(e.target.value)} className="input-box w-full font-mono text-xs" />
          </div>
          {msg && <p className="text-sm text-danger" role="alert">{msg}</p>}
          <button type="submit" disabled={busy} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-sm font-medium px-6 h-11 rounded-full disabled:opacity-50">
            {busy ? 'Saving…' : 'Add service'}
          </button>
        </form>
      )}

      <div className={`${canCreate ? 'lg:col-span-3' : 'lg:col-span-5'} space-y-6`}>
        <section className="g-card p-5 space-y-3">
          <h3 className="font-medium">Bookable services ({services.length})</h3>
          {loading ? (
            <p className="text-sm text-secondary">Loading…</p>
          ) : services.length === 0 ? (
            <p className="text-sm text-secondary">No services yet. Add one so buyers can book appointments on your storefront.</p>
          ) : (
            <div className="divide-y divide-theme">
              {services.map((s) => (
                <div key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{s.title} {!s.is_active && <span className="text-xs text-secondary">(paused)</span>}</p>
                    <p className="text-xs text-secondary">{s.duration_mins} mins · {s.price > 0 ? formatMoney(s.price, site.currency) : 'Free'} · {s.slot_hours.join(', ')}</p>
                  </div>
                  {canCreate && (
                    <button type="button" onClick={() => toggleService(s)} className="px-3.5 h-9 rounded-full border border-theme hover:bg-hover text-xs font-medium">
                      {s.is_active ? 'Pause' : 'Resume'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="g-card p-5 space-y-3">
          <h3 className="font-medium">Appointments ({bookings.length})</h3>
          {bookings.length === 0 ? (
            <p className="text-sm text-secondary">No bookings yet.</p>
          ) : (
            <div className="divide-y divide-theme">
              {bookings.map((b) => (
                <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{svcNames.get(b.service_id) || 'Appointment'} · {b.slot_date} at {b.slot_time}</p>
                    <p className="text-xs text-secondary">
                      {b.buyer_name} ({b.buyer_email}{b.buyer_phone ? ` · ${b.buyer_phone}` : ''}) · <strong className="capitalize">{b.status}</strong>
                    </p>
                    {b.notes && <p className="text-xs text-secondary mt-0.5">{b.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {b.status === 'pending' && (
                      <button type="button" onClick={() => updateStatus(b.id, 'confirmed')} className="px-3.5 h-9 rounded-full bg-accent text-[var(--accent-foreground)] text-xs font-medium">
                        Confirm
                      </button>
                    )}
                    {b.status === 'confirmed' && (
                      <button type="button" onClick={() => updateStatus(b.id, 'completed')} className="px-3.5 h-9 rounded-full border border-theme text-xs font-medium">
                        Mark done
                      </button>
                    )}
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <button type="button" onClick={() => updateStatus(b.id, 'cancelled')} className="px-3.5 h-9 rounded-full border border-theme text-xs text-danger">
                        Cancel
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
