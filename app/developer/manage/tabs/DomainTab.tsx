'use client';

import { useCallback, useEffect, useState } from 'react';
import { jsonFetch, type Site } from '../types';

interface DomainState {
  domain: string | null;
  verified: boolean;
  txt_name: string | null;
  txt_value: string | null;
  cname_target: string;
  plan_allows_domain: boolean;
  ownership_found?: boolean;
  pointing?: boolean;
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch {} }}
      className="text-xs text-accent font-medium hover:underline ml-2"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function DomainTab({ site, goToPlan }: { site: Site; goToPlan: () => void }) {
  const [state, setState] = useState<DomainState | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'add' | 'verify' | 'remove' | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await jsonFetch<DomainState>(`/api/forums/${site.slug}/domain`);
    if (r.ok) setState(r.data as DomainState);
  }, [site.slug]);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('add'); setError('');
    const r = await jsonFetch<DomainState>(`/api/forums/${site.slug}/domain`, { method: 'POST', body: { domain: input } });
    if (r.ok) { setState(r.data as DomainState); setInput(''); } else setError(r.data.error || 'Could not add the domain.');
    setBusy(null);
  };
  const verify = async () => {
    setBusy('verify'); setError('');
    const r = await jsonFetch<DomainState>(`/api/forums/${site.slug}/domain`, { method: 'PUT' });
    if (r.ok) setState(r.data as DomainState); else setError(r.data.error || 'Could not check the domain.');
    setBusy(null);
  };
  const remove = async () => {
    if (!confirm('Disconnect this domain? Your yourname.developa.me address keeps working.')) return;
    setBusy('remove');
    await jsonFetch(`/api/forums/${site.slug}/domain`, { method: 'DELETE' });
    setState(null); await load();
    setBusy(null);
  };

  const allowed = state?.plan_allows_domain ?? false;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="g-card p-5">
        <h3 className="font-medium">Your addresses</h3>
        <p className="text-sm text-secondary mt-1">Your store is always available at <span className="font-mono text-primary">{site.slug}.developa.me</span>. You can also connect your own domain.</p>
      </div>

      {!state?.domain ? (
        <form onSubmit={add} className="g-card p-5 space-y-3">
          <h3 className="font-medium">Connect your own domain</h3>
          <div>
            <label htmlFor="d-input" className="block text-sm font-medium mb-1.5">Domain</label>
            <input id="d-input" required value={input} onChange={(e) => setInput(e.target.value)} placeholder="shop.yourbrand.com" className="input-box w-full" />
          </div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <button type="submit" disabled={busy === 'add'} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full disabled:opacity-50">
            {busy === 'add' ? 'Adding…' : 'Add domain'}
          </button>
          {!allowed && <p className="text-xs text-secondary">You can add and verify a domain on any plan. It goes live once your site is on Pro.</p>}
        </form>
      ) : (
        <div className="g-card p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono font-medium">{state.domain}</p>
              <p className="text-sm mt-1">
                {state.verified ? <span className="text-success font-medium">Ownership verified</span> : <span className="text-warning font-medium">Waiting for DNS</span>}
                {state.verified && !allowed && <span className="text-secondary"> · goes live on the Pro plan</span>}
                {state.verified && allowed && <span className="text-secondary"> · live</span>}
              </p>
            </div>
            <div className="flex gap-2">
              {!state.verified && (
                <button onClick={verify} disabled={busy === 'verify'} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-5 h-10 rounded-full disabled:opacity-50">
                  {busy === 'verify' ? 'Checking…' : 'Check now'}
                </button>
              )}
              <button onClick={remove} disabled={busy === 'remove'} className="text-sm px-4 h-10 rounded-full border border-theme text-danger">Remove</button>
            </div>
          </div>

          {!state.verified && (
            <div className="text-sm space-y-3">
              <p className="text-secondary">Add these two records where you manage your domain (your registrar or DNS provider), then press “Check now”. DNS changes can take a few minutes to a few hours.</p>
              <div className="rounded-2xl border border-theme p-4 space-y-2 overflow-x-auto">
                <p className="font-medium">1. Prove you own it (TXT record)</p>
                <p>Name: <span className="font-mono">{state.txt_name}</span><Copy text={state.txt_name || ''} /></p>
                <p>Value: <span className="font-mono break-all">{state.txt_value}</span><Copy text={state.txt_value || ''} /></p>
              </div>
              <div className="rounded-2xl border border-theme p-4 space-y-2 overflow-x-auto">
                <p className="font-medium">2. Send visitors to your store (CNAME record)</p>
                <p>Name: <span className="font-mono">{state.domain.split('.').length > 2 ? state.domain.split('.')[0] : '@'}</span></p>
                <p>Points to: <span className="font-mono">{state.cname_target}</span><Copy text={state.cname_target} /></p>
              </div>
              {state.ownership_found === false && <p className="text-warning">We could not find the TXT record yet. Check the name and value, and try again in a few minutes.</p>}
            </div>
          )}
          {state.verified && state.pointing === false && (
            <p className="text-sm text-warning">Your domain is verified, but it does not point at your store yet. Add the CNAME record to <span className="font-mono">{state.cname_target}</span>.</p>
          )}
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          {!allowed && (
            <p className="text-sm text-secondary">
              Custom domains are part of the Pro plan. <button onClick={goToPlan} className="text-accent font-medium hover:underline">See plans</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
