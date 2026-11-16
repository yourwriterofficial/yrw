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
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState('all');
  // One demo preview for every theme: pick a theme and see exactly what customers see.
  const [previewId, setPreviewId] = useState('');
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');

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
  const hiddenCount = themes.filter((t) => !t.is_active).length;
  const groups = Array.from(new Set(themes.map((t) => t.group)));
  const shownThemes = themes.filter((t) => (grp === 'all' || t.group === grp) && (!q.trim() || t.label.toLowerCase().includes(q.trim().toLowerCase())));

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

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Themes', value: themes.length },
          { label: 'Premium (paid)', value: premiumCount },
          { label: 'Hidden from new sites', value: hiddenCount },
        ].map((x) => (
          <div key={x.label} className="bg-card border border-theme rounded-2xl p-4 min-w-0">
            <p className="text-xs font-semibold text-secondary truncate">{x.label}</p>
            <p className="text-xl font-black mt-1 tabular-nums">{x.value}</p>
          </div>
        ))}
      </div>

      <section className="bg-card border border-theme rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-theme flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 basis-56">
            <h3 className="font-bold">Demo preview</h3>
            <p className="text-xs text-secondary mt-0.5">One demo store for every theme. Pick a theme to see it exactly as customers see it.</p>
          </div>
          <select value={previewId || themes[0]?.id || ''} onChange={(e) => setPreviewId(e.target.value)} aria-label="Theme to preview" className="h-10 rounded-xl border border-theme bg-card px-3 text-sm font-medium max-w-full">
            {themes.map((t) => <option key={t.id} value={t.id}>{t.label}{t.price_ngn > 0 ? ` · ${naira(t.price_ngn)}` : ' · Free'}</option>)}
          </select>
          <div className="flex gap-1 p-1 rounded-lg bg-secondary/60 border border-theme" role="group" aria-label="Screen size">
            {(['desktop', 'phone'] as const).map((d) => <button key={d} onClick={() => setDevice(d)} aria-pressed={device === d} className={`h-8 px-3 rounded-md text-xs font-semibold capitalize ${device === d ? 'bg-card shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}>{d}</button>)}
          </div>
          <a href={`/developer/preview/${previewId || themes[0]?.id || ''}`} target="_blank" rel="noreferrer" className="h-10 px-4 rounded-xl border border-theme hover:bg-hover text-sm font-medium inline-flex items-center">Open full page</a>
        </div>
        <div className="bg-secondary/40 p-4 flex justify-center">
          {themes.length === 0 ? (
            <p className="text-sm text-secondary py-16">Loading themes…</p>
          ) : (
            <iframe
              key={(previewId || themes[0]?.id) + device}
              src={`/developer/preview/${previewId || themes[0]?.id}`}
              title="Theme demo preview"
              className={`bg-white rounded-xl border border-theme ${device === 'phone' ? 'w-[390px] max-w-full' : 'w-full'}`}
              style={{ height: '70vh', minHeight: 420 }}
              loading="lazy"
            />
          )}
        </div>
      </section>

      <section className="bg-card border border-theme rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-theme space-y-3">
          <div>
            <h3 className="font-bold">Theme prices</h3>
            <p className="text-xs text-secondary mt-0.5">A price above ₦0 makes a theme premium. ₦0 makes it free. Untick &quot;Shown&quot; to hide a theme from new sites.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search themes" aria-label="Search themes" className="h-9 flex-1 min-w-[160px] rounded-lg border border-theme bg-card px-3 text-sm" />
            {['all', ...groups].map((g) => (
              <button key={g} onClick={() => setGrp(g)} aria-pressed={grp === g} className={`h-9 px-3 rounded-lg text-xs font-semibold border capitalize ${grp === g ? 'border-accent bg-accent/10 text-accent' : 'border-theme text-secondary hover:bg-hover'}`}>{g === 'all' ? 'All' : g}</button>
            ))}
          </div>
        </div>
        <div>
          {shownThemes.length === 0 && <p className="p-6 text-sm text-secondary text-center">No themes match.</p>}
          {Array.from(new Set(shownThemes.map((t) => t.group))).map((g) => {
            const inGroup = shownThemes.filter((t) => t.group === g);
            const prem = inGroup.filter((t) => t.price_ngn > 0).length;
            const anyDirty = inGroup.some((t) => dirty(t));
            return (
              <details key={g} className="group border-b border-theme last:border-0" open={!!q.trim() || grp === g || anyDirty}>
                <summary className="px-5 py-3 flex items-center gap-3 cursor-pointer list-none hover:bg-hover">
                  <span className="font-semibold capitalize">{g}</span>
                  <span className="text-xs text-secondary">{inGroup.length} {inGroup.length === 1 ? 'theme' : 'themes'}{prem ? ` · ${prem} premium` : ''}</span>
                  <span className="ml-auto text-secondary text-lg leading-none transition group-open:rotate-90">›</span>
                </summary>
                <ul className="divide-y divide-theme border-t border-theme">
                  {inGroup.map((t) => {
                    const v = value(t);
                    const changed = dirty(t);
                    return (
                      <li key={t.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1 basis-44">
                          <button onClick={() => { setPreviewId(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-sm font-semibold truncate text-left hover:text-accent" title="Show in the demo preview">{t.label}</button>
                          {t.default_price_ngn !== t.price_ngn && <p className="text-xs text-secondary">default {naira(t.default_price_ngn)}</p>}
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${Number(v.price) > 0 ? 'bg-accent/10 text-accent' : 'bg-secondary text-secondary'}`}>{Number(v.price) > 0 ? 'Premium' : 'Free'}</span>
                        <div className="relative shrink-0">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary">₦</span>
                          <input type="number" min={0} step={500} value={v.price} onChange={(e) => setEdits({ ...edits, [t.id]: { ...v, price: e.target.value } })} aria-label={`Price for ${t.label}`} className="h-9 w-28 rounded-lg border border-theme bg-primary pl-7 pr-2 text-sm font-semibold tabular-nums" />
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-medium shrink-0 cursor-pointer select-none">
                          <input type="checkbox" checked={v.active} onChange={(e) => setEdits({ ...edits, [t.id]: { ...v, active: e.target.checked } })} aria-label={`Show ${t.label}`} className="w-4 h-4 accent-[var(--accent)]" /> Shown
                        </label>
                        <button disabled={!changed} onClick={() => save(t)} className={`h-9 px-4 rounded-lg text-xs font-bold shrink-0 ${changed ? 'bg-accent text-[var(--accent-foreground)]' : 'bg-secondary text-secondary opacity-50'}`}>Save</button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
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
