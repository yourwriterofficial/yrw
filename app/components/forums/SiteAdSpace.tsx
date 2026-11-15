'use client';

import { useEffect, useState } from 'react';
import { sharedJson } from '@/lib/sharedFetch';
import { X } from 'lucide-react';

interface Slot { id: string; name: string; placement: string; price_ngn: number; days: number; description: string }
interface Running { id: string; title: string; link_url: string; image_url: string; placement: string }
interface PayTo { bank_name: string; account_number: string; account_name: string; instructions: string; whatsapp: string }

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');

/**
 * Ads the site owner sold, plus the "Advertise here" button and booking form.
 * Renders nothing unless the owner is on a plan that sells ad space and has created a slot.
 */
export default function SiteAdSpace({ slug, placement }: { slug: string; placement: 'banner' | 'sidebar' | 'footer' }) {
  const [data, setData] = useState<{ enabled: boolean; slots: Slot[]; running: Running[] } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    sharedJson<{ enabled: boolean; slots: Slot[]; running: Running[] }>(`/api/forums/${encodeURIComponent(slug)}/ad-space`)
      .then((j) => { if (active && j?.enabled) setData(j); });
    return () => { active = false; };
  }, [slug]);

  if (!data) return null;
  const mine = data.running.filter((a) => a.placement === placement);
  const slotHere = data.slots.filter((s) => s.placement === placement);
  if (mine.length === 0 && slotHere.length === 0) return null;

  return (
    <div className="my-4">
      {mine.slice(0, 2).map((a) => {
        const inner = a.image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={a.image_url} alt={a.title} className="w-full max-h-40 object-cover rounded-2xl" loading="lazy" />
          : <div className="rounded-2xl g-tonal px-5 py-4 text-sm font-medium">{a.title}</div>;
        return a.link_url
          ? <a key={a.id} href={a.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block mb-2">{inner}</a>
          : <div key={a.id} className="mb-2">{inner}</div>;
      })}
      {slotHere.length > 0 && (
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-secondary hover:text-primary underline underline-offset-4">
          Advertise here
        </button>
      )}
      {open && <BookingModal slug={slug} slots={data.slots} onClose={() => setOpen(false)} />}
    </div>
  );
}

function BookingModal({ slug, slots, onClose }: { slug: string; slots: Slot[]; onClose: () => void }) {
  const [slotId, setSlotId] = useState(slots[0]?.id || '');
  const [f, setF] = useState({ advertiser_name: '', advertiser_email: '', advertiser_phone: '', title: '', link_url: '', image_url: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ reference: string; amount: number; pay_to: PayTo } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setErr('');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload/drive', { method: 'POST', body: fd });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) setF((p) => ({ ...p, image_url: j.url }));
    else setErr(res.status === 401 ? 'Sign in to upload a banner here, or paste a link to your image instead.' : j.error || 'Upload failed. Paste an image link instead.');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const res = await fetch(`/api/forums/${encodeURIComponent(slug)}/ad-space`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, slot_id: slotId }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setDone(j); else setErr(j.error || 'Could not send your request.');
  };

  const slot = slots.find((s) => s.id === slotId);
  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Advertise here">
      <div className="bg-card w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <h2 className="g-h3">{done ? 'Request sent' : 'Advertise here'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 -m-2 text-secondary hover:text-primary"><X className="w-5 h-5" /></button>
        </div>
        {done ? (
          <div className="mt-4 space-y-3 text-sm">
            <p>Your reference is <strong>{done.reference}</strong>. Pay <strong>{naira(done.amount)}</strong> to the seller, then message them your reference. Your ad goes live once they confirm.</p>
            <div className="g-tonal p-4 space-y-1">
              {done.pay_to.account_number ? (<>
                <p><span className="text-secondary">Bank:</span> {done.pay_to.bank_name}</p>
                <p><span className="text-secondary">Account number:</span> <span className="font-mono">{done.pay_to.account_number}</span></p>
                <p><span className="text-secondary">Account name:</span> {done.pay_to.account_name}</p>
              </>) : <p>The seller will contact you with payment details.</p>}
              {done.pay_to.instructions && <p className="text-secondary">{done.pay_to.instructions}</p>}
            </div>
            <button onClick={onClose} className="bg-accent text-[var(--accent-foreground)] px-6 h-11 rounded-full font-medium">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
            <label className="block font-medium">Slot
              <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className="input-box w-full mt-1">
                {slots.map((s) => <option key={s.id} value={s.id}>{s.name} · {naira(s.price_ngn)} for {s.days} days</option>)}
              </select>
            </label>
            {slot?.description && <p className="text-secondary -mt-1">{slot.description}</p>}
            <input required placeholder="Your name or business" value={f.advertiser_name} onChange={set('advertiser_name')} className="input-box w-full" />
            <div className="grid sm:grid-cols-2 gap-3">
              <input required type="email" placeholder="Email" value={f.advertiser_email} onChange={set('advertiser_email')} className="input-box w-full" />
              <input type="tel" placeholder="Phone (optional)" value={f.advertiser_phone} onChange={set('advertiser_phone')} className="input-box w-full" />
            </div>
            <input required placeholder="Headline for your ad" maxLength={100} value={f.title} onChange={set('title')} className="input-box w-full" />
            <input type="url" placeholder="Where should it link? (https://…)" value={f.link_url} onChange={set('link_url')} className="input-box w-full" />
            <div>
              <input type="url" placeholder="Banner image link (https://…) or upload below" value={f.image_url} onChange={set('image_url')} className="input-box w-full" />
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => upload(e.target.files?.[0])} className="mt-2 text-xs" />
            </div>
            {err && <p className="text-danger" role="alert">{err}</p>}
            <button type="submit" disabled={busy} className="w-full bg-accent text-[var(--accent-foreground)] h-12 rounded-full font-medium disabled:opacity-50">{busy ? 'Sending…' : 'Send request'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
