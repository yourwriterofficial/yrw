'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '@/app/components/ui/PageHeader';
import { formatMoney, type ForumSummary } from '@/lib/forums';
import { PLANS, daysLeft, effectiveTier, type PlanTier } from '@/lib/plans';

interface AdminSiteRow extends ForumSummary {
  owner_name: string;
  total_products: number;
  total_orders: number;
  total_gmv: number;
  plan_expires_at?: string | null;
}
interface PaymentRow { id: number; site_id: string; site_name: string; site_slug: string; plan_tier: string; months: number; amount: number; reference: string | null; note: string | null; created_at: string }
interface AdRow { id: string; title: string; body: string; link_url: string; image_url: string; placement: 'banner' | 'footer'; target_site_id: string | null; is_active: boolean; starts_at: string | null; ends_at: string | null }

type Tab = 'sites' | 'payments' | 'ads';
const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');

async function api<T = Record<string, unknown>>(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, data };
}

export default function AdminDevelopaSitesPage() {
  const [tab, setTab] = useState<Tab>('sites');
  const [sites, setSites] = useState<AdminSiteRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [ads, setAds] = useState<AdRow[]>([]);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, p, a] = await Promise.all([
      api<{ sites?: AdminSiteRow[] }>('/api/admin/developa-sites'),
      api<{ payments?: PaymentRow[]; needs_update?: boolean }>('/api/admin/developa-sites/payments'),
      api<{ ads?: AdRow[]; needs_update?: boolean }>('/api/admin/developa-ads'),
    ]);
    setSites(s.data.sites || []);
    setPayments(p.data.payments || []);
    setAds(a.data.ads || []);
    setNeedsUpdate(!!p.data.needs_update || !!a.data.needs_update);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const flash = (ok: boolean, text: string) => { setNote({ ok, text }); setTimeout(() => setNote(null), 5000); };

  const kpi = useMemo(() => {
    const paid = sites.filter((s) => effectiveTier(s.plan_tier, s.plan_expires_at) !== 'free');
    const mrr = paid.reduce((sum, s) => sum + PLANS[effectiveTier(s.plan_tier, s.plan_expires_at)].priceNgn, 0);
    const soon = paid.filter((s) => { const d = daysLeft(s.plan_expires_at); return d !== null && d <= 7; }).length;
    return {
      sites: sites.length,
      gmv: sites.reduce((n, s) => n + s.total_gmv, 0),
      orders: sites.reduce((n, s) => n + s.total_orders, 0),
      paidSites: paid.length,
      mrr,
      soon,
      received: payments.reduce((n, p) => n + Number(p.amount), 0),
    };
  }, [sites, payments]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Developa platform"
        description="All stores and communities, paid plans, and the ads you show on every site."
        breadcrumb="Admin / Developa"
      />

      {needsUpdate && (
        <p className="text-sm text-warning border border-warning/30 rounded-xl p-4">
          Plan payments and platform ads need migration <span className="font-mono">20261114010000_site_owner_tools.sql</span> to be applied first.
        </p>
      )}
      {note && <p className={`text-sm rounded-xl p-3 border ${note.ok ? 'text-success border-success/30' : 'text-danger border-danger/30'}`} role="status">{note.text}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Sites" value={String(kpi.sites)} sub={`${kpi.paidSites} on a paid plan`} />
        <Kpi label="Plan income per month" value={naira(kpi.mrr)} sub={kpi.soon ? `${kpi.soon} ending within 7 days` : 'from active paid plans'} />
        <Kpi label="Plan payments received" value={naira(kpi.received)} sub={`${payments.length} recorded`} />
        <Kpi label="Sales across all stores" value={formatMoney(kpi.gmv)} sub={`${kpi.orders} orders`} />
      </div>

      <div className="flex gap-2 border-b border-theme pb-3">
        {([['sites', 'Sites'], ['payments', 'Plan payments'], ['ads', 'Ads on all sites']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 h-10 rounded-full text-sm font-medium ${tab === k ? 'bg-accent text-[var(--accent-foreground)]' : 'text-secondary hover:bg-hover'}`}>{label}</button>
        ))}
        <button onClick={loadAll} className="ml-auto px-4 h-10 rounded-full text-sm border border-theme hover:bg-hover">Refresh</button>
      </div>

      {loading ? <p className="text-sm text-secondary">Loading…</p> : (
        <>
          {tab === 'sites' && <SitesTab sites={sites} reload={loadAll} flash={flash} />}
          {tab === 'payments' && <PaymentsTab payments={payments} />}
          {tab === 'ads' && <AdsTab ads={ads} sites={sites} reload={loadAll} flash={flash} />}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="g-card p-5">
      <p className="text-sm text-secondary">{label}</p>
      <p className="text-2xl font-medium mt-1 break-words">{value}</p>
      {sub && <p className="text-xs text-secondary mt-1">{sub}</p>}
    </div>
  );
}

/* ------------------------------ Sites ------------------------------ */
function SitesTab({ sites, reload, flash }: { sites: AdminSiteRow[]; reload: () => Promise<void>; flash: (ok: boolean, t: string) => void }) {
  const [query, setQuery] = useState('');
  const [paying, setPaying] = useState<AdminSiteRow | null>(null);
  const shown = sites.filter((s) => !query.trim() || [s.name, s.slug, s.owner_name, s.custom_domain || ''].some((v) => v.toLowerCase().includes(query.trim().toLowerCase())));

  const patch = async (s: AdminSiteRow, body: Record<string, unknown>, okText: string) => {
    const r = await api('/api/admin/developa-sites', 'PATCH', { id: s.id, ...body });
    flash(r.ok, r.ok ? okText : (r.data.error as string) || 'Could not update.');
    await reload();
  };

  return (
    <div className="space-y-4">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by site, owner or domain" aria-label="Search sites" className="input-box w-full max-w-md" />
      {shown.length === 0 ? <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">No sites match.</p> : (
        <div className="g-card overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[860px]">
            <thead className="text-secondary border-b border-theme">
              <tr>{['Site', 'Owner', 'Type', 'Domain', 'Orders', 'Sales', 'Plan', ''].map((h) => <th key={h} className="p-3.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {shown.map((s) => {
                const tier = effectiveTier(s.plan_tier, s.plan_expires_at);
                const left = daysLeft(s.plan_expires_at);
                return (
                  <tr key={s.id}>
                    <td className="p-3.5">
                      <p className="font-medium">{s.name} {!s.is_public && <span className="text-xs text-warning font-normal">· hidden</span>}</p>
                      <a href={`/forums/${s.slug}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline">{s.slug}.developa.me</a>
                    </td>
                    <td className="p-3.5 text-secondary">{s.owner_name}</td>
                    <td className="p-3.5 text-secondary capitalize">{s.site_mode || 'forum'}</td>
                    <td className="p-3.5 font-mono text-xs">
                      {s.custom_domain ? <>{s.custom_domain}<br /><span className={s.custom_domain_verified ? 'text-success' : 'text-warning'}>{s.custom_domain_verified ? 'verified' : 'not verified'}</span></> : <span className="text-secondary">none</span>}
                    </td>
                    <td className="p-3.5">{s.total_orders}</td>
                    <td className="p-3.5">{formatMoney(s.total_gmv, s.currency || 'NGN')}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${tier === 'free' ? 'bg-secondary text-secondary' : 'bg-accent text-[var(--accent-foreground)]'}`}>{PLANS[tier].name}</span>
                      {s.plan_tier !== 'free' && s.plan_expires_at && (
                        <p className={`text-xs mt-1 ${left !== null && left <= 7 ? 'text-warning' : 'text-secondary'}`}>
                          {left !== null && left < 0 ? 'ended' : `${left}d left`} · {new Date(s.plan_expires_at).toLocaleDateString('en-GB')}
                        </p>
                      )}
                      {s.plan_tier !== 'free' && !s.plan_expires_at && <p className="text-xs text-secondary mt-1">no end date</p>}
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1 justify-end">
                        <button onClick={() => setPaying(s)} className="px-3 h-8 rounded-full bg-accent text-[var(--accent-foreground)] text-xs font-medium">Record payment</button>
                        {s.plan_tier !== 'free' && <button onClick={() => patch(s, { plan_tier: 'free', plan_expires_at: null }, `${s.name} moved to Starter`)} className="px-3 h-8 rounded-full border border-theme text-xs">Set Starter</button>}
                        {s.custom_domain && !s.custom_domain_verified && <button onClick={() => patch(s, { custom_domain_verified: true }, 'Domain marked verified')} className="px-3 h-8 rounded-full border border-theme text-xs">Verify domain</button>}
                        <button onClick={() => patch(s, { is_public: !s.is_public }, s.is_public ? `${s.name} hidden` : `${s.name} is live`)} className="px-3 h-8 rounded-full border border-theme text-xs">{s.is_public ? 'Hide' : 'Show'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {paying && <PaymentModal site={paying} onClose={() => setPaying(null)} onDone={async (t) => { setPaying(null); flash(true, t); await reload(); }} flash={flash} />}
    </div>
  );
}

function PaymentModal({ site, onClose, onDone, flash }: { site: AdminSiteRow; onClose: () => void; onDone: (t: string) => Promise<void>; flash: (ok: boolean, t: string) => void }) {
  const [tier, setTier] = useState<'pro' | 'business'>(site.plan_tier === 'business' ? 'business' : 'pro');
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);
  const suggested = PLANS[tier].priceNgn * months;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await api('/api/admin/developa-sites', 'POST', { action: 'record_payment', site_id: site.id, plan_tier: tier, months, amount: amount === '' ? undefined : Number(amount), reference, note: noteText });
    if (r.ok) await onDone(`Recorded ${PLANS[tier].name} for ${site.name}: ${months} month${months > 1 ? 's' : ''}`);
    else { flash(false, (r.data.error as string) || 'Could not record the payment.'); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-primary rounded-[var(--radius-card)] p-6 w-full max-w-md space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="g-h3">Record a plan payment</h3>
        <p className="text-sm text-secondary">{site.name} · {site.slug}.developa.me. The plan starts now, or extends from the current end date if it is still running.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="pm-tier">Plan</label>
            <select id="pm-tier" value={tier} onChange={(e) => setTier(e.target.value as 'pro' | 'business')} className="input-box w-full">
              {(['pro', 'business'] as PlanTier[]).map((t) => <option key={t} value={t}>{PLANS[t].name} · {naira(PLANS[t].priceNgn)}/mo</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="pm-months">Months</label>
            <input id="pm-months" type="number" min={1} max={36} value={months} onChange={(e) => setMonths(Math.max(1, Math.min(36, Number(e.target.value) || 1)))} className="input-box w-full" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="pm-amt">Amount received <span className="text-secondary font-normal">(blank = {naira(suggested)})</span></label>
          <input id="pm-amt" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(suggested)} className="input-box w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="pm-ref">Transfer reference <span className="text-secondary font-normal">(optional)</span></label>
          <input id="pm-ref" value={reference} onChange={(e) => setReference(e.target.value)} className="input-box w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="pm-note">Note <span className="text-secondary font-normal">(optional)</span></label>
          <input id="pm-note" value={noteText} onChange={(e) => setNoteText(e.target.value)} className="input-box w-full" />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={busy} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full disabled:opacity-50">{busy ? 'Saving…' : 'Record and activate'}</button>
          <button type="button" onClick={onClose} className="px-5 h-11 rounded-full border border-theme text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

/* ----------------------------- Payments ----------------------------- */
function PaymentsTab({ payments }: { payments: PaymentRow[] }) {
  if (payments.length === 0) return <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">No plan payments recorded yet. Use “Record payment” on the Sites tab when someone pays you.</p>;
  return (
    <div className="g-card overflow-x-auto">
      <table className="w-full text-sm text-left min-w-[640px]">
        <thead className="text-secondary border-b border-theme"><tr>{['Date', 'Site', 'Plan', 'Months', 'Amount', 'Reference / note'].map((h) => <th key={h} className="p-3.5 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-theme">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="p-3.5 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString('en-GB')}</td>
              <td className="p-3.5">{p.site_name}<br /><span className="font-mono text-xs text-secondary">{p.site_slug}</span></td>
              <td className="p-3.5 capitalize">{p.plan_tier}</td>
              <td className="p-3.5">{p.months}</td>
              <td className="p-3.5 font-medium">{naira(Number(p.amount))}</td>
              <td className="p-3.5 text-secondary">{[p.reference, p.note].filter(Boolean).join(' · ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------- Ads -------------------------------- */
function AdsTab({ ads, sites, reload, flash }: { ads: AdRow[]; sites: AdminSiteRow[]; reload: () => Promise<void>; flash: (ok: boolean, t: string) => void }) {
  const BLANK = { title: '', body: '', link_url: '', image_url: '', placement: 'banner', target: 'all', starts: '', ends: '' };
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await api('/api/admin/developa-ads', 'POST', {
      title: f.title, body: f.body, link_url: f.link_url, image_url: f.image_url, placement: f.placement,
      target_site_id: f.target === 'all' ? null : f.target,
      starts_at: f.starts ? new Date(f.starts + 'T00:00:00').toISOString() : null,
      ends_at: f.ends ? new Date(f.ends + 'T23:59:59').toISOString() : null,
    });
    if (r.ok) { setF(BLANK); flash(true, 'Ad is live on the chosen sites.'); await reload(); }
    else flash(false, (r.data.error as string) || 'Could not create the ad.');
    setBusy(false);
  };
  const toggle = async (a: AdRow) => { await api('/api/admin/developa-ads', 'PATCH', { id: a.id, is_active: !a.is_active }); await reload(); };
  const remove = async (a: AdRow) => { if (!confirm(`Delete the ad "${a.title}"?`)) return; await api(`/api/admin/developa-ads?id=${a.id}`, 'DELETE'); await reload(); };
  const siteName = (id: string | null) => (id ? sites.find((s) => s.id === id)?.name || 'One site' : 'Every site');

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <form onSubmit={create} className="lg:col-span-2 g-card p-5 space-y-4 h-fit">
        <h3 className="font-medium">New ad</h3>
        <p className="text-xs text-secondary">Shown on the stores and communities of owners on the Starter plan. Pro and Business sites do not show platform ads.</p>
        <div><label className="block text-sm font-medium mb-1.5" htmlFor="ad-t">Headline</label><input id="ad-t" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="input-box w-full" /></div>
        <div><label className="block text-sm font-medium mb-1.5" htmlFor="ad-b">Short text</label><input id="ad-b" maxLength={240} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="input-box w-full" /></div>
        <div><label className="block text-sm font-medium mb-1.5" htmlFor="ad-l">Link</label><input id="ad-l" type="url" placeholder="https://" value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} className="input-box w-full" /></div>
        <div><label className="block text-sm font-medium mb-1.5" htmlFor="ad-i">Image link <span className="text-secondary font-normal">(optional, https)</span></label><input id="ad-i" type="url" value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} className="input-box w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium mb-1.5" htmlFor="ad-p">Where</label>
            <select id="ad-p" value={f.placement} onChange={(e) => setF({ ...f, placement: e.target.value })} className="input-box w-full"><option value="banner">Top of the page</option><option value="footer">Above the footer</option></select></div>
          <div><label className="block text-sm font-medium mb-1.5" htmlFor="ad-s">Which sites</label>
            <select id="ad-s" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} className="input-box w-full"><option value="all">Every site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium mb-1.5" htmlFor="ad-st">Starts</label><input id="ad-st" type="date" value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} className="input-box w-full" /></div>
          <div><label className="block text-sm font-medium mb-1.5" htmlFor="ad-en">Ends</label><input id="ad-en" type="date" value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} className="input-box w-full" /></div>
        </div>
        <button type="submit" disabled={busy} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full disabled:opacity-50">{busy ? 'Saving…' : 'Publish ad'}</button>
      </form>

      <div className="lg:col-span-3 space-y-3">
        {ads.length === 0 && <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">No ads yet.</p>}
        {ads.map((a) => (
          <div key={a.id} className="g-card p-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{a.title} {!a.is_active && <span className="text-secondary font-normal">· paused</span>}</p>
              <p className="text-sm text-secondary">{a.placement === 'banner' ? 'Top of page' : 'Above footer'} · {siteName(a.target_site_id)}
                {a.ends_at && ` · until ${new Date(a.ends_at).toLocaleDateString('en-GB')}`}</p>
            </div>
            <div className="flex gap-1 text-sm">
              <button onClick={() => toggle(a)} className="px-3 h-9 rounded-full hover:bg-hover">{a.is_active ? 'Pause' : 'Resume'}</button>
              <button onClick={() => remove(a)} className="px-3 h-9 rounded-full hover:bg-hover text-danger">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
