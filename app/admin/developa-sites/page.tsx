'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '@/app/components/ui/PageHeader';
import { formatMoney, type ForumSummary } from '@/lib/forums';
import { PLANS, PLAN_ORDER, PAID_TIERS, daysLeft, effectiveTier, type PlanTier } from '@/lib/plans';
import SupportInboxTab from './SupportInboxTab';
import ThemesTab from './ThemesTab';
import ControlDrawer from './ControlDrawer';
import AnnounceTab from './AnnounceTab';
import AuditTab from './AuditTab';
import ReportsTab from './ReportsTab';
import { type SiteStateRow, type UserStateRow, STATUS_STYLE } from './adminApi';

interface AdminSiteRow extends ForumSummary {
  owner_name: string;
  total_products: number;
  total_orders: number;
  total_gmv: number;
  plan_expires_at?: string | null;
}
interface PaymentRow { id: number; site_id: string; site_name: string; site_slug: string; plan_tier: string; months: number; amount: number; reference: string | null; note: string | null; created_at: string }
interface MonthlySettlementRow { month: string; orders: number; gross: number; platform_fee: number; seller_net: number }
interface AdRow { id: string; title: string; body: string; link_url: string; image_url: string; placement: 'banner' | 'footer'; target_site_id: string | null; is_active: boolean; starts_at: string | null; ends_at: string | null }

type Tab = 'sites' | 'reports' | 'announce' | 'payments' | 'themes' | 'ads' | 'support' | 'audit';
const TAB_INFO: Record<Tab, [string, string]> = {
  sites: ['Sites', 'Every store and community, with its plan, sales and owner. Open one to limit, edit or ban it.'],
  reports: ['Reports', 'Abuse reports from visitors. Review them, take things down, or dismiss.'],
  announce: ['Announcements', 'Send a notice to site owners: in their bell, inbox or email. Schedule it for later if you like.'],
  payments: ['Plan payments', 'Paid plans you have recorded, and what each month brought in.'],
  themes: ['Themes and prices', 'Which themes exist and what the premium ones cost.'],
  ads: ['Ads on all sites', 'Ads you show on free sites, with how many people saw and clicked them.'],
  support: ['Priority support', 'Requests from paying site owners who get a faster reply.'],
  audit: ['History', 'Everything an admin changed, and who did it.'],
};
const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');

async function api<T = Record<string, unknown>>(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, data };
}

export default function AdminDevelopaSitesPage() {
  const [tab, setTabState] = useState<Tab>('sites');
  // The open tab lives in the address (?tab=), so the sidebar can link straight to it.
  const TABS: Tab[] = ['sites', 'reports', 'announce', 'payments', 'themes', 'ads', 'support', 'audit'];
  useEffect(() => {
    const read = () => { const t = new URLSearchParams(window.location.search).get('tab') as Tab | null; setTabState(t && TABS.includes(t) ? t : 'sites'); };
    read();
    window.addEventListener('admintab', read);
    window.addEventListener('popstate', read);
    return () => { window.removeEventListener('admintab', read); window.removeEventListener('popstate', read); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setTab = (t: Tab) => { setTabState(t); window.history.replaceState(null, '', `?tab=${t}`); window.dispatchEvent(new Event('admintab')); };
  const [sites, setSites] = useState<AdminSiteRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [settlements, setSettlements] = useState<MonthlySettlementRow[]>([]);
  const [ads, setAds] = useState<AdRow[]>([]);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [controlNeedsUpdate, setControlNeedsUpdate] = useState(false);
  const [siteStates, setSiteStates] = useState<Record<string, SiteStateRow>>({});
  const [openSiteId, setOpenSiteId] = useState<string | null>(null);
  const [userStates, setUserStates] = useState<Record<string, UserStateRow>>({});
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, p, a, c] = await Promise.all([
      api<{ sites?: AdminSiteRow[]; monthly_settlements?: MonthlySettlementRow[] }>('/api/admin/developa-sites'),
      api<{ payments?: PaymentRow[]; needs_update?: boolean }>('/api/admin/developa-sites/payments'),
      api<{ ads?: AdRow[]; needs_update?: boolean }>('/api/admin/developa-ads'),
      api<{ sites?: Record<string, SiteStateRow>; users?: Record<string, UserStateRow>; needs_update?: boolean }>('/api/admin/developa-control'),
    ]);
    setSiteStates(c.data.sites || {});
    setUserStates(c.data.users || {});
    setControlNeedsUpdate(!!c.data.needs_update);
    setSites(s.data.sites || []);
    setSettlements(s.data.monthly_settlements || []);
    setPayments(p.data.payments || []);
    setAds(a.data.ads || []);
    setNeedsUpdate(!!p.data.needs_update || !!a.data.needs_update);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (active) await loadAll();
    })();
    return () => { active = false; };
  }, [loadAll]);

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
        title={TAB_INFO[tab][0]}
        description={TAB_INFO[tab][1]}
        breadcrumb="Admin / Developa"
        actions={<button onClick={loadAll} className="px-4 h-10 rounded-xl text-sm font-medium border border-theme hover:bg-hover">Refresh</button>}
      />

      {needsUpdate && (
        <p className="text-sm text-warning border border-warning/30 rounded-xl p-4">
          Plan payments and platform ads need migration <span className="font-mono">20261114010000_site_owner_tools.sql</span> to be applied first.
        </p>
      )}
      {controlNeedsUpdate && (
        <p className="text-sm text-warning border border-warning/30 rounded-xl p-4">
          Banning, limits, announcements and the history need migration <span className="font-mono">20261115030000_platform_admin_controls.sql</span> to be applied first. Until then everything below still works, but those controls cannot save.
        </p>
      )}
      {note && <p className={`text-sm rounded-xl p-3 border ${note.ok ? 'text-success border-success/30' : 'text-danger border-danger/30'}`} role="status">{note.text}</p>}

      {tab === 'sites' && <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi label="Sites" value={String(kpi.sites)} sub={`${kpi.paidSites} on a paid plan`} />
        <Kpi label="Plan income per month" value={naira(kpi.mrr)} sub={kpi.soon ? `${kpi.soon} ending within 7 days` : 'from active paid plans'} />
        <Kpi label="Plan payments received" value={naira(kpi.received)} sub={`${payments.length} recorded`} />
        <Kpi label="Sales across all stores" value={formatMoney(kpi.gmv)} sub={`${kpi.orders} ${kpi.orders === 1 ? 'order' : 'orders'}`} />
      </div>}


      {loading ? <p className="text-sm text-secondary">Loading…</p> : (
        <>
          {tab === 'sites' && <SitesTab sites={sites} reload={loadAll} flash={flash} siteStates={siteStates} userStates={userStates} openSiteId={openSiteId} clearOpenSite={() => setOpenSiteId(null)} />}
          {tab === 'reports' && <ReportsTab flash={flash} openSite={(id) => { setOpenSiteId(id); setTab('sites'); }} />}
          {tab === 'announce' && <AnnounceTab sites={sites} flash={flash} />}
          {tab === 'payments' && <PaymentsTab payments={payments} settlements={settlements} />}
          {tab === 'themes' && <ThemesTab flash={flash} />}
          {tab === 'ads' && <AdsTab ads={ads} sites={sites} reload={loadAll} flash={flash} />}
          {tab === 'support' && <SupportInboxTab flash={flash} />}
          {tab === 'audit' && <AuditTab />}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-theme rounded-2xl p-4 min-w-0">
      <p className="text-xs font-semibold text-secondary truncate">{label}</p>
      <p className="text-xl font-black mt-1 tabular-nums whitespace-nowrap truncate" title={value}>{value}</p>
      {sub && <p className="text-[11px] text-secondary mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

/* ------------------------------ Sites ------------------------------ */
function SitesTab({ sites, reload, flash, siteStates, userStates, openSiteId, clearOpenSite }: { sites: AdminSiteRow[]; reload: () => Promise<void>; flash: (ok: boolean, t: string) => void; siteStates: Record<string, SiteStateRow>; userStates: Record<string, UserStateRow>; openSiteId: string | null; clearOpenSite: () => void }) {
  const [controlling, setControlling] = useState<AdminSiteRow | null>(() => (openSiteId ? sites.find((x) => x.id === openSiteId) || null : null));
  useEffect(() => { if (openSiteId) clearOpenSite(); }, [openSiteId, clearOpenSite]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'problem'>('all');
  const [query, setQuery] = useState('');
  const [soonOnly, setSoonOnly] = useState(false);
  const [paying, setPaying] = useState<AdminSiteRow | null>(null);
  const [verifying, setVerifying] = useState<AdminSiteRow | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const shown = sites.filter((s) => {
    if (soonOnly) {
      const l = daysLeft(s.plan_expires_at);
      if (s.plan_tier === 'free' || l === null || l > 7) return false;
    }
    if (statusFilter === 'problem' && (siteStates[s.id]?.status || 'active') === 'active') return false;
    return !query.trim() || [s.name, s.slug, s.owner_name, s.custom_domain || ''].some((v) => v.toLowerCase().includes(query.trim().toLowerCase()));
  });

  const patch = async (s: AdminSiteRow, body: Record<string, unknown>, okText: string) => {
    const r = await api('/api/admin/developa-sites', 'PATCH', { id: s.id, ...body });
    flash(r.ok, r.ok ? okText : (r.data.error as string) || 'Could not update.');
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <svg className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by site, owner or domain" aria-label="Search sites" className="w-full h-10 rounded-xl border border-theme bg-card pl-9 pr-3 text-sm" />
        </div>
        <button type="button" onClick={() => setSoonOnly((p) => !p)} aria-pressed={soonOnly} className={`h-10 px-4 rounded-xl text-sm font-medium border transition-colors ${soonOnly ? 'border-accent bg-accent/10 text-accent' : 'border-theme text-secondary hover:bg-hover'}`}>Ending within 7 days</button>
        <button type="button" onClick={() => setStatusFilter((p) => (p === 'all' ? 'problem' : 'all'))} aria-pressed={statusFilter === 'problem'} className={`h-10 px-4 rounded-xl text-sm font-medium border transition-colors ${statusFilter === 'problem' ? 'border-accent bg-accent/10 text-accent' : 'border-theme text-secondary hover:bg-hover'}`}>Limited, suspended or banned</button>
      </div>
      {shown.length === 0 ? <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">No sites match.</p> : (
        <ul className="space-y-3">
          {shown.map((s) => {
            const tier = effectiveTier(s.plan_tier, s.plan_expires_at);
            const left = daysLeft(s.plan_expires_at);
            const st = siteStates[s.id]?.status;
            const accent = /^#[0-9a-fA-F]{6}$/.test(s.accent_color || '') ? s.accent_color : '#2563eb';
            return (
              <li key={s.id} className="bg-card border border-theme rounded-2xl p-4 flex flex-wrap items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0" style={{ background: accent }}>{(s.name[0] || '?').toUpperCase()}</div>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate">{s.name}</span>
                    {s.verified && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-success/10 text-success">Verified</span>}
                    {!s.is_public && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-warning/10 text-warning">Hidden</span>}
                    {st && st !== 'active' && <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-secondary capitalize ${STATUS_STYLE[st]}`}>{st}</span>}
                    {userStates[s.owner_id]?.status === 'banned' && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-danger/10 text-danger">Owner banned</span>}
                  </p>
                  <a href={`/forums/${s.slug}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline break-all">{s.slug}.developa.me</a>
                  <p className="text-xs text-secondary mt-0.5 truncate">
                    {s.owner_name} · <span className="capitalize">{s.site_mode || 'forum'}</span>
                    {s.custom_domain ? <> · {s.custom_domain} <span className={s.custom_domain_verified ? 'text-success' : 'text-warning'}>({s.custom_domain_verified ? 'verified' : 'not verified'})</span></> : null}
                  </p>
                </div>
                <div className="flex items-center gap-6 shrink-0 text-right">
                  <div>
                    <p className="text-[11px] text-secondary">Sales</p>
                    <p className="text-sm font-bold tabular-nums whitespace-nowrap">{formatMoney(s.total_gmv, s.currency || 'NGN')}</p>
                    <p className="text-[11px] text-secondary">{s.total_orders} {s.total_orders === 1 ? 'order' : 'orders'}</p>
                  </div>
                  <div className="min-w-[96px]">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${tier === 'free' ? 'bg-secondary text-secondary' : 'bg-accent text-[var(--accent-foreground)]'}`}>{PLANS[tier].name}</span>
                    {s.plan_tier !== 'free' && s.plan_expires_at && (
                      <p className={`text-[11px] mt-1 ${left !== null && left <= 7 ? 'text-warning font-semibold' : 'text-secondary'}`}>{left !== null && left < 0 ? 'ended' : `${left}d left`}</p>
                    )}
                    {s.plan_tier !== 'free' && !s.plan_expires_at && <p className="text-[11px] text-secondary mt-1">no end date</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 relative">
                  <button onClick={() => setControlling(s)} className="h-9 px-4 rounded-lg bg-accent text-[var(--accent-foreground)] text-sm font-semibold">Manage</button>
                  <button onClick={() => setMenuFor(menuFor === s.id ? null : s.id)} aria-label={`More actions for ${s.name}`} aria-expanded={menuFor === s.id} className="h-9 w-9 rounded-lg border border-theme hover:bg-hover inline-flex items-center justify-center text-lg leading-none">⋯</button>
                  {menuFor === s.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                      <div className="absolute right-0 top-11 z-20 w-56 bg-card border border-theme rounded-xl shadow-elevation-3 p-1.5 text-sm">
                        {[
                          { label: 'Record a plan payment', run: () => setPaying(s) },
                          ...(s.plan_tier !== 'free' ? [{ label: 'Move to Starter (free)', run: () => patch(s, { plan_tier: 'free', plan_expires_at: null }, `${s.name} moved to Starter`) }] : []),
                          s.verified
                            ? { label: 'Remove Verified seller', run: () => patch(s, { verified: false }, `${s.name} verification removed`) }
                            : { label: 'Verify seller', run: () => setVerifying(s) },
                          ...(s.custom_domain && !s.custom_domain_verified ? [{ label: 'Mark domain verified', run: () => patch(s, { custom_domain_verified: true }, 'Domain marked verified') }] : []),
                          { label: s.is_public ? 'Hide this site' : 'Make this site live', run: () => patch(s, { is_public: !s.is_public }, s.is_public ? `${s.name} hidden` : `${s.name} is live`) },
                        ].map((m) => (
                          <button key={m.label} onClick={() => { setMenuFor(null); m.run(); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-hover">{m.label}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {controlling && (
        <ControlDrawer
          site={controlling}
          state={siteStates[controlling.id]}
          userState={userStates[controlling.owner_id]}
          onClose={() => setControlling(null)}
          onChanged={async (msg, ok = true) => { flash(ok, msg); if (ok) { setControlling(null); await reload(); } }}
        />
      )}
      {paying && <PaymentModal site={paying} onClose={() => setPaying(null)} onDone={async (t) => { setPaying(null); flash(true, t); await reload(); }} flash={flash} />}
      {verifying && (
        <VerifySellerModal
          site={verifying}
          onClose={() => setVerifying(null)}
          onConfirm={async () => {
            const target = verifying;
            setVerifying(null);
            await patch(target, { verified: true }, `${target.name} marked as Verified seller`);
          }}
        />
      )}
    </div>
  );
}

function VerifySellerModal({ site, onClose, onConfirm }: { site: AdminSiteRow; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [checks, setChecks] = useState({ products: site.total_products > 0, contact: !!site.whatsapp_number, clean: false });
  const [busy, setBusy] = useState(false);
  const ready = checks.products && checks.contact && checks.clean;
  return (
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="g-card p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="g-h3">Verify seller: {site.name}</h3>
        <p className="text-sm text-secondary">Confirm the manual checklist before showing the Verified seller badge on this storefront:</p>
        <div className="space-y-2.5 text-sm">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={checks.products} onChange={(e) => setChecks((c) => ({ ...c, products: e.target.checked }))} className="w-4 h-4" />
            <span>Active products listed ({site.total_products} found)</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={checks.contact} onChange={(e) => setChecks((c) => ({ ...c, contact: e.target.checked }))} className="w-4 h-4" />
            <span>Working WhatsApp or contact details ({site.whatsapp_number || 'check manually'})</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={checks.clean} onChange={(e) => setChecks((c) => ({ ...c, clean: e.target.checked }))} className="w-4 h-4" />
            <span>No scam reports or prohibited items</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-full border border-theme text-sm">Cancel</button>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}
            className="h-10 px-5 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Mark verified'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({ site, onClose, onDone, flash }: { site: AdminSiteRow; onClose: () => void; onDone: (t: string) => Promise<void>; flash: (ok: boolean, t: string) => void }) {
  const [tier, setTier] = useState<PlanTier>(site.plan_tier && PAID_TIERS.includes(site.plan_tier) ? site.plan_tier : 'pro');
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
            <select id="pm-tier" value={tier} onChange={(e) => setTier(e.target.value as PlanTier)} className="input-box w-full">
              {PAID_TIERS.map((t) => <option key={t} value={t}>{PLANS[t].name} · {naira(PLANS[t].priceNgn)}/mo</option>)}
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
function PaymentsTab({ payments, settlements }: { payments: PaymentRow[]; settlements: MonthlySettlementRow[] }) {
  const totalPlans = payments.reduce((n, p) => n + Number(p.amount), 0);
  const totalFees = settlements.reduce((n, m) => n + Number(m.platform_fee), 0);
  const latest = settlements[0];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Plan payments received" value={naira(totalPlans)} sub={`${payments.length} recorded`} />
        <Kpi label="Platform fees earned" value={naira(totalFees)} sub="from online orders" />
        <Kpi label={latest ? `Fees in ${latest.month}` : 'Fees this month'} value={naira(latest ? Number(latest.platform_fee) : 0)} sub={latest ? `${latest.orders} online ${latest.orders === 1 ? 'order' : 'orders'}` : 'no online orders yet'} />
      </div>

      <section className="bg-card border border-theme rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-theme">
          <h3 className="font-bold">Online order settlements, by month</h3>
          <p className="text-xs text-secondary mt-0.5">What shoppers paid online, the platform fee we kept, and what sellers received.</p>
        </div>
        {settlements.length === 0 ? (
          <p className="p-6 text-sm text-secondary">No online orders settled yet.</p>
        ) : (
          <ul className="divide-y divide-theme">
            {settlements.map((m) => (
              <li key={m.month} className="px-5 py-3 grid grid-cols-2 sm:grid-cols-[110px_repeat(4,minmax(0,1fr))] gap-x-4 gap-y-1 items-center">
                <p className="font-mono font-bold col-span-2 sm:col-span-1">{m.month}</p>
                <div><p className="text-[11px] text-secondary">Orders</p><p className="text-sm font-semibold tabular-nums">{m.orders}</p></div>
                <div><p className="text-[11px] text-secondary">Shoppers paid</p><p className="text-sm font-semibold tabular-nums">{naira(m.gross)}</p></div>
                <div><p className="text-[11px] text-secondary">Platform fee</p><p className="text-sm font-bold tabular-nums text-success">{naira(m.platform_fee)}</p></div>
                <div><p className="text-[11px] text-secondary">Sellers received</p><p className="text-sm font-semibold tabular-nums">{naira(m.seller_net)}</p></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-card border border-theme rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-theme">
          <h3 className="font-bold">Plan payments</h3>
          <p className="text-xs text-secondary mt-0.5">Each time a site owner paid for a paid plan.</p>
        </div>
        {payments.length === 0 ? (
          <p className="p-8 text-sm text-secondary text-center">No plan payments recorded yet. Use “Record a plan payment” in the site&apos;s ⋯ menu on the Sites page when someone pays you.</p>
        ) : (
          <ul className="divide-y divide-theme">
            {payments.map((p) => (
              <li key={p.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold shrink-0">{(p.site_name[0] || '?').toUpperCase()}</div>
                <div className="min-w-0 flex-1 basis-44">
                  <p className="text-sm font-semibold truncate">{p.site_name}</p>
                  <p className="text-xs text-secondary truncate">{[p.reference, p.note].filter(Boolean).join(' · ') || p.site_slug}</p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-secondary capitalize shrink-0">{p.plan_tier} · {p.months} {p.months === 1 ? 'month' : 'months'}</span>
                <div className="text-right shrink-0 min-w-[96px]">
                  <p className="text-sm font-black tabular-nums">{naira(Number(p.amount))}</p>
                  <p className="text-[11px] text-secondary">{new Date(p.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* -------------------------------- Ads -------------------------------- */
function AdsTab({ ads, sites, reload, flash }: { ads: AdRow[]; sites: AdminSiteRow[]; reload: () => Promise<void>; flash: (ok: boolean, t: string) => void }) {
  const BLANK = { title: '', body: '', link_url: '', image_url: '', placement: 'banner', target: 'all', starts: '', ends: '', tiers: ['free'] as string[] };
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await api('/api/admin/developa-ads', 'POST', {
      title: f.title, body: f.body, link_url: f.link_url, image_url: f.image_url, placement: f.placement,
      target_site_id: f.target === 'all' ? null : f.target,
      target_tiers: f.tiers.length ? f.tiers : ['free'],
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
    <div className="grid xl:grid-cols-5 gap-6">
      <form onSubmit={create} className="xl:col-span-2 g-card p-5 space-y-4 h-fit">
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
        <div>
          <p className="block text-sm font-medium mb-1.5">Show on these plans</p>
          <div className="flex flex-wrap gap-2">
            {PLAN_ORDER.map((t) => (
              <button type="button" key={t} aria-pressed={f.tiers.includes(t)} onClick={() => setF({ ...f, tiers: f.tiers.includes(t) ? f.tiers.filter((x) => x !== t) : [...f.tiers, t] })} className={`h-9 px-4 rounded-full text-sm border ${f.tiers.includes(t) ? 'border-accent bg-accent/10 font-medium' : 'border-theme hover:bg-hover'}`}>{PLANS[t].name}</button>
            ))}
          </div>
          <p className="text-xs text-secondary mt-1.5">Free sites are the usual choice. Paid plans can be added for a launch or a partner.</p>
        </div>
        <button type="submit" disabled={busy} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full disabled:opacity-50">{busy ? 'Saving…' : 'Publish ad'}</button>
      </form>

      <div className="xl:col-span-3 space-y-3">
        {ads.length === 0 && <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">No ads yet.</p>}
        {ads.map((a) => (
          <div key={a.id} className="g-card p-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{a.title} {!a.is_active && <span className="text-secondary font-normal">· paused</span>}</p>
              <p className="text-xs text-secondary mb-0.5">{(a as { impressions?: number }).impressions ?? 0} views · {(a as { clicks?: number }).clicks ?? 0} clicks{((a as { impressions?: number }).impressions ?? 0) > 0 ? ` · ${((((a as { clicks?: number }).clicks ?? 0) / ((a as { impressions?: number }).impressions ?? 1)) * 100).toFixed(1)}% clicked` : ''}</p>
              <p className="text-sm text-secondary">{a.placement === 'banner' ? 'Top of page' : 'Above footer'} · {siteName(a.target_site_id)} · {((a as { target_tiers?: string[] }).target_tiers || ['free']).map((t) => PLANS[t as PlanTier]?.name || t).join(', ')}
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
