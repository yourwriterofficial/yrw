'use client';

import { useState } from 'react';

const SERVICES = [
  { value: 'academic', label: 'Academic Writing & Research' },
  { value: 'statistics', label: 'Statistics & Fieldwork' },
  { value: 'content', label: 'Content Writing' },
  { value: 'resume', label: 'Resume & CV' },
  { value: 'dev', label: 'Software Development' },
];

export default function QuoteRequestForm({
  defaultService = 'academic',
  brand = 'yourresearchwriter',
  services,
  bare = false,
  initialDetails = '',
}: {
  defaultService?: string;
  brand?: 'yourresearchwriter' | 'developa';
  /** Limit the service dropdown (e.g. developa only offers 'dev'). */
  services?: string[];
  /** Render without its own border/background, for placing inside another card. */
  bare?: boolean;
  /** Pre-fills "What do you need?" (used when the hero field passes the brief on). */
  initialDetails?: string;
}) {
  const options = services ? SERVICES.filter((s) => services.includes(s.value)) : SERVICES;
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setStatus('sending');
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...Object.fromEntries(form.entries()), brand }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send your request.');
      setStatus('done');
    } catch (err: any) {
      setError(err.message || 'Could not send your request.');
      setStatus('idle');
    }
  }

  if (status === 'done') {
    return (
      <div className="border border-theme rounded-lg p-6">
        <p className="font-semibold">Request sent.</p>
        <p className="text-sm text-secondary mt-1">
          We will email you a quote within 24 hours. Check your spam folder if you don&apos;t see it.
        </p>
      </div>
    );
  }

  const label = 'block text-sm font-medium mb-1.5';

  return (
    <form onSubmit={onSubmit} className={bare ? 'space-y-4' : 'border border-theme rounded-lg p-5 sm:p-6 space-y-4 bg-card'}>
      {/* Honeypot, hidden from people */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="q-name" className={label}>Name</label>
          <input id="q-name" name="name" required maxLength={100} className="input-box w-full" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="q-email" className={label}>Email</label>
          <input id="q-email" name="email" type="email" required className="input-box w-full" autoComplete="email" />
        </div>
        <div>
          <label htmlFor="q-whatsapp" className={label}>WhatsApp <span className="text-secondary font-normal">(optional)</span></label>
          <input id="q-whatsapp" name="whatsapp" type="tel" className="input-box w-full" autoComplete="tel" />
        </div>
        <div>
          <label htmlFor="q-deadline" className={label}>Deadline <span className="text-secondary font-normal">(optional)</span></label>
          <input id="q-deadline" name="deadline" type="date" className="input-box w-full" />
        </div>
      </div>

      {options.length > 1 && (
        <div>
          <label htmlFor="q-service" className={label}>Service</label>
          <select id="q-service" name="service" defaultValue={defaultService} className="input-box w-full">
            {options.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}
      {options.length === 1 && <input type="hidden" name="service" value={options[0].value} />}

      <div>
        <label htmlFor="q-details" className={label}>What do you need?</label>
        <textarea
          id="q-details"
          name="details"
          defaultValue={initialDetails}
          required
          minLength={10}
          maxLength={4000}
          rows={4}
          className="input-box w-full"
          placeholder="Topic or project, length or scope, and anything else we should know."
        />
      </div>

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="inline-flex items-center justify-center rounded-lg bg-accent text-white font-semibold px-5 py-2.5 text-sm hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {status === 'sending' ? 'Sending…' : 'Get a quote'}
      </button>
      <p className="text-xs text-secondary">No payment needed. We reply within 24 hours.</p>
    </form>
  );
}
