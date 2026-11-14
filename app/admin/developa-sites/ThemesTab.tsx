'use client';

import { useCallback, useEffect, useState } from 'react';

interface Theme { id: string; label: string; group: string; price_ngn: number; default_price_ngn: number; is_active: boolean }
interface Purchase { id: string; template_id: string; amount: number; status: 'pending' | 'paid' | 'rejected'; reference: string; created_at: string; email: string }

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');

async function api<T = Record<string, unknown>>(method: string, body?: unknown) {
  const res = await fetch('/api/admin/developa-themes', { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, data };
}

export default function ThemesTab({ flash }: { flash: (ok: boolean, text: string) => void }) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [edits, setEdits] = useState<Record<string, { price: string; active: boolean }>>({});
  const [grant, setGrant] = useState({ email: '', template_id: '' });
  const [needsUpdate, setNeedsUpdate] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ themes?: Theme[]; purchases?: Purchase[]; needs_update?: boolean }>('GET');
    if (!r.ok) return;
    setThemes(r.data.themes || []);
    setPurchases(r.data.purchases || []);
    setNeedsUpdate(!!r.data.needs_update);
    setEdits({});
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const value = (t: Theme) => edits[t.id] ?? { price: String(t.price_ngn), active: t.is_active };
  const dirty = (t: Theme) => !!edits[t.id] && (Number(edits[t.id].price) !== t.price_ngn || edits[t.id].active !== t.is_active);

  const save = async (t: Theme) => {
    const v = value(t);
    const r = await api('PUT', { template_id: t.id, price_ngn: Math.max(0, Math.round(Number(v.price) || 0)), is_active: v.active });
    flash(r.ok, r.ok ? `${t.label} saved.` : (r.data.error as string) || 'Could not save.');
    if (r.ok) load();
  };
  const decide = async (p: Purchase, status: 'paid' | 'rejected') => {
    const r = await api('PATCH', { id: p.id, status });
    flash(r.ok, r.ok ? (status === 'paid' ? 'Theme unlocked for that account.' : 'Request rejected.') : (r.data.error as string) || 'Could not update.');
    if (r.ok) load();
  };
  const gift = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api('POST', grant);
    flash(r.ok, r.ok ? 'Theme granted.' : (r.data.error as string) || 'Could not grant.');
    if (r.ok) setGrant({ email: '', template_id: '' });
  };

  const label = (id: string) => themes.find((t) => t.id === id)?.label || id;
  const pending = purchases.filter((p) => p.status === 'pending');
  const premiumCount = themes.filter((t) => t.price_ngn > 0).length;

  return (
    <div className="space-y-6">
      {needsUpdate && <p className="text-sm text-warning border border-warning/30 rounded-xl p-4">Theme sales need migration <span className="font-mono">20261114060000_themes_plugins_push.sql</span> to be applied first.</p>}

      {pending.length > 0 && (
        <section className="g-card p-5">
          <h3 className="font-medium mb-3">Theme payments to confirm ({pending.length})</h3>
          <ul className="divide-y divide-theme text-sm">
            {pending.map((p) => (
              <li key={p.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div><p className="font-medium">{label(p.template_id)} <span className="text-secondary font-normal">· {naira(p.amount)} · {p.reference}</span></p><p className="text-secondary">{p.email || 'Unknown account'} · {new Date(p.created_at).toLocaleString('en-GB')}</p></div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => decide(p, 'paid')} className="bg-accent text-[var(--accent-foreground)] px-5 h-10 rounded-full text-sm font-medium">Money received, unlock</button>
                  <button onClick={() => decide(p, 'rejected')} className="border border-theme px-5 h-10 rounded-full text-sm">Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="g-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div><h3 className="font-medium">Theme prices</h3><p className="text-sm text-secondary mt-1">Set a price to make a theme premium. Set it to 0 to make it free. Switch a theme off to hide it from new sites. {premiumCount} premium now.</p></div>
        </div>
        <div className="g-scroll-x mt-4">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-left text-secondary text-xs"><th className="py-2 pr-3 font-medium">Theme</th><th className="py-2 pr-3 font-medium">Price (₦)</th><th className="py-2 pr-3 font-medium">Shown</th><th /></tr></thead>
            <tbody className="divide-y divide-theme">
              {themes.map((t) => {
                const v = value(t);
                return (
                  <tr key={t.id}>
                    <td className="py-2.5 pr-3"><p className="font-medium">{t.label}</p><p className="text-xs text-secondary capitalize">{t.group}{t.default_price_ngn !== t.price_ngn ? ` · default ${naira(t.default_price_ngn)}` : ''}</p></td>
                    <td className="py-2.5 pr-3"><input type="number" min={0} step={500} value={v.price} onChange={(e) => setEdits({ ...edits, [t.id]: { ...v, price: e.target.value } })} aria-label={`Price for ${t.label}`} className="input-box w-32 !py-2 text-sm" /></td>
                    <td className="py-2.5 pr-3"><input type="checkbox" checked={v.active} onChange={(e) => setEdits({ ...edits, [t.id]: { ...v, active: e.target.checked } })} aria-label={`Show ${t.label}`} className="w-5 h-5 accent-[var(--accent)]" /></td>
                    <td className="py-2.5 text-right"><button disabled={!dirty(t)} onClick={() => save(t)} className="px-4 h-9 rounded-full bg-accent text-[var(--accent-foreground)] text-xs font-medium disabled:opacity-30">Save</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="g-card p-5">
        <h3 className="font-medium">Give someone a theme</h3>
        <form onSubmit={gift} className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="text-xs font-medium flex-1">Their email<input type="email" required value={grant.email} onChange={(e) => setGrant({ ...grant, email: e.target.value })} className="input-box w-full mt-1 text-sm" /></label>
          <label className="text-xs font-medium flex-1">Theme
            <select required value={grant.template_id} onChange={(e) => setGrant({ ...grant, template_id: e.target.value })} className="input-box w-full mt-1 text-sm">
              <option value="">Choose…</option>
              {themes.filter((t) => t.price_ngn > 0).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <button type="submit" className="px-6 h-11 rounded-full border border-theme hover:bg-hover text-sm font-medium">Grant</button>
        </form>
      </section>

      {purchases.filter((p) => p.status !== 'pending').length > 0 && (
        <section className="g-card p-5">
          <h3 className="font-medium mb-3">Past theme sales</h3>
          <ul className="divide-y divide-theme text-sm">
            {purchases.filter((p) => p.status !== 'pending').slice(0, 30).map((p) => (
              <li key={p.id} className="py-2.5 flex flex-wrap justify-between gap-2"><span>{label(p.template_id)} <span className="text-secondary">· {p.email || 'account'}</span></span><span className="text-secondary capitalize">{p.status} · {naira(p.amount)}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
