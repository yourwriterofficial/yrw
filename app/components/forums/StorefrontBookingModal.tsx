'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { formatMoney, type ForumSummary } from '@/lib/forums';

export interface PublicBookingService {
  id: string;
  title: string;
  description: string;
  duration_mins: number;
  price: number;
  slot_days: string[];
  slot_hours: string[];
}

export interface TakenSlot {
  service_id: string;
  slot_date: string;
  slot_time: string;
}

export default function StorefrontBookingModal({
  site,
  services,
  takenSlots,
  onClose,
  onBooked,
}: {
  site: ForumSummary;
  services: PublicBookingService[];
  takenSlots: TakenSlot[];
  onClose: () => void;
  onBooked: () => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const today = new Date().toISOString().slice(0, 10);
  const [slotDate, setSlotDate] = useState(today);
  const selectedService = services.find((s) => s.id === serviceId) || services[0];
  const hours = selectedService?.slot_hours || ['09:00', '14:00'];
  const [slotTime, setSlotTime] = useState(hours[0] || '09:00');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const isTaken = (t: string) =>
    takenSlots.some((s) => s.service_id === serviceId && s.slot_date === slotDate && s.slot_time === t);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'book',
          service_id: serviceId,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          slot_date: slotDate,
          slot_time: slotTime,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save booking.');
        setBusy(false);
        return;
      }
      setDone(true);
      onBooked();
    } catch {
      setError('Network error while booking.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="g-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-theme pb-3">
          <h3 className="font-bold text-base">Book an appointment</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="space-y-3 text-sm">
            <p className="text-success font-medium">Booking request sent for {slotDate} at {slotTime}.</p>
            <p className="text-secondary text-xs">We emailed a copy to {buyerEmail}. {site.name} will confirm shortly.</p>
            <button type="button" onClick={onClose} className="w-full h-11 rounded-full bg-accent text-[var(--accent-foreground)] font-medium text-sm">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 text-xs">
            <div>
              <label htmlFor="sb-svc" className="block font-medium mb-1">Service</label>
              <select
                id="sb-svc"
                value={serviceId}
                onChange={(e) => {
                  const next = services.find((s) => s.id === e.target.value);
                  setServiceId(e.target.value);
                  if (next?.slot_hours?.[0]) setSlotTime(next.slot_hours[0]);
                }}
                className="input-box w-full text-xs"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.duration_mins} mins · {s.price > 0 ? formatMoney(s.price, site.currency) : 'Free'})
                  </option>
                ))}
              </select>
              {selectedService?.description && <p className="text-secondary mt-1">{selectedService.description}</p>}
            </div>

            <div>
              <label htmlFor="sb-date" className="block font-medium mb-1">Date</label>
              <input id="sb-date" type="date" min={today} required value={slotDate} onChange={(e) => setSlotDate(e.target.value)} className="input-box w-full text-xs" />
            </div>

            <div>
              <p className="font-medium mb-1">Available time slots</p>
              <div className="flex flex-wrap gap-1.5">
                {hours.map((h) => {
                  const taken = isTaken(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={taken}
                      onClick={() => setSlotTime(h)}
                      className={`px-3 h-9 rounded-xl border text-xs font-mono ${
                        taken
                          ? 'opacity-40 line-through border-theme'
                          : slotTime === h
                          ? 'bg-accent text-[var(--accent-foreground)] border-accent'
                          : 'border-theme bg-card'
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            <input required value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Your full name" aria-label="Full name" className="input-box w-full text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <input type="email" required value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="Email" aria-label="Email" className="input-box w-full text-xs" />
              <input type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="Phone / WhatsApp" aria-label="Phone" className="input-box w-full text-xs" />
            </div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Booking notes" className="input-box w-full text-xs" />

            {error && <p className="text-danger" role="alert">{error}</p>}
            <button type="submit" disabled={busy || isTaken(slotTime)} className="w-full h-11 rounded-full bg-accent text-[var(--accent-foreground)] font-medium text-sm disabled:opacity-50">
              {busy ? 'Reserving…' : 'Request booking'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
