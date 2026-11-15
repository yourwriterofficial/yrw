'use client';

import { useState } from 'react';
import { Flag, X } from 'lucide-react';

type Target = { type: 'site' } | { type: 'product'; id: string; title: string } | { type: 'thread'; id: string; title: string };

const REASONS = [
  { key: 'scam', label: 'Looks like a scam or fraud' },
  { key: 'counterfeit', label: 'Fake or counterfeit goods' },
  { key: 'illegal', label: 'Illegal or dangerous' },
  { key: 'abuse', label: 'Abusive or offensive' },
  { key: 'spam', label: 'Spam' },
  { key: 'other', label: 'Something else' },
] as const;

/** A short form anyone can use to report a store, an item or a post to the developa.me team. */
export default function ReportDialog({ slug, target, label, className }: { slug: string; target: Target; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]['key']>('scam');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(slug)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: target.type, target_id: target.type === 'site' ? undefined : target.id, reason, details, email }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { setMsg({ ok: true, text: 'Thank you. Our team will look at this.' }); setDetails(''); }
      else setMsg({ ok: false, text: j.error || 'Could not send the report.' });
    } catch { setMsg({ ok: false, text: 'Could not send the report. Check your connection.' }); }
    setBusy(false);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className || 'inline-flex items-center gap-1 hover:text-danger'}>
        <Flag className="w-3 h-3" /> {label || 'Report abuse or scam'}
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/60" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Report">
          <form onSubmit={send} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-card border border-theme p-5 space-y-4 text-primary">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-base">Report {target.type === 'site' ? 'this store' : target.type === 'product' ? 'this item' : 'this post'}</h3>
                {target.type !== 'site' && <p className="text-xs text-secondary mt-0.5 line-clamp-1">{target.title}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-hover flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            {msg?.ok ? <p className="text-sm text-success" role="status">{msg.text}</p> : (
              <>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium mb-1">What is wrong?</legend>
                  {REASONS.map((r) => (
                    <label key={r.key} className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="reason" checked={reason === r.key} onChange={() => setReason(r.key)} className="w-4 h-4" /> {r.label}</label>
                  ))}
                </fieldset>
                <div><label htmlFor="rp-d" className="block text-sm font-medium mb-1">More details <span className="text-secondary font-normal">(optional)</span></label><textarea id="rp-d" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} className="input-box w-full" /></div>
                <div><label htmlFor="rp-e" className="block text-sm font-medium mb-1">Your email <span className="text-secondary font-normal">(optional, only if you want an answer)</span></label><input id="rp-e" type="email" maxLength={150} value={email} onChange={(e) => setEmail(e.target.value)} className="input-box w-full" /></div>
                {msg && !msg.ok && <p className="text-sm text-danger" role="alert">{msg.text}</p>}
                <button type="submit" disabled={busy} className="w-full bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm h-11 rounded-full disabled:opacity-50">{busy ? 'Sending…' : 'Send report'}</button>
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
}
