'use client';

import { useEffect, useState } from 'react';
import { PLANS, PLAN_ORDER, type PlanTier } from '@/lib/plans';
import { RESTRICTION_LABELS } from '@/lib/adminLabels';
import { adminApi, type SiteStateRow, type UserStateRow } from './adminApi';

interface SiteLite {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  owner_name: string;
  plan_tier?: string | null;
  plan_expires_at?: string | null;
}

interface AuditEntry { id: string; action: string; admin_email: string | null; detail: Record<string, unknown>; created_at: string }

const STATUSES: { key: SiteStateRow['status']; label: string; hint: string }[] = [
  { key: 'active', label: 'Active', hint: 'Normal. Nothing is limited.' },
  { key: 'restricted', label: 'Restricted', hint: 'Live, but with the limits you pick below.' },
  { key: 'suspended', label: 'Suspended', hint: 'Taken offline. No orders. The owner can still sign in and see why.' },
  { key: 'banned', label: 'Banned', hint: 'Offline for good. Use for fraud or serious abuse.' },
];

const label = 'block text-sm font-medium mb-1.5';

/**
 * Everything the platform can decide about one site and its owner: status, limits, the owner's account, the plan,
 * private notes, and the history of what has been done.
 */
export default function ControlDrawer({
  site, state, userState, onClose, onChanged,
}: {
  site: SiteLite;
  state?: SiteStateRow;
  userState?: UserStateRow;
  onClose: () => void;
  onChanged: (message: string, ok?: boolean) => void;
}) {
  const [status, setStatus] = useState<SiteStateRow['status']>(state?.status || 'active');
  const [restrictions, setRestrictions] = useState<Record<string, boolean | number | null | undefined>>(state?.restrictions || {});
  const [reason, setReason] = useState(state?.reason || '');
  const [note, setNote] = useState(state?.admin_note || '');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [uStatus, setUStatus] = useState<UserStateRow['status']>(userState?.status || 'active');
  const [uReason, setUReason] = useState(userState?.reason || '');
  const [maxSites, setMaxSites] = useState(userState?.max_sites_override != null ? String(userState.max_sites_override) : '');

  const [tier, setTier] = useState<PlanTier>((site.plan_tier as PlanTier) || 'free');
  const [months, setMonths] = useState(1);
  const [planReason, setPlanReason] = useState('');

  const [history, setHistory] = useState<AuditEntry[]>([]);
  useEffect(() => {
    let active = true;
    adminApi<{ entries?: AuditEntry[] }>(`/api/admin/developa-audit?site_id=${site.id}`).then((r) => { if (active) setHistory(r.data.entries || []); });
    return () => { active = false; };
  }, [site.id]);

  const run = async (key: string, payload: Record<string, unknown>, okText: string) => {
    setBusy(key);
    const r = await adminApi('/api/admin/developa-control', 'POST', payload);
    setBusy(null);
    onChanged(r.ok ? okText : ((r.data.error as string) || 'That did not work.'), r.ok);
    return r.ok;
  };

  const saveSite = async () => {
    if ((status === 'banned' || status === 'suspended') && !reason.trim()) { onChanged('Add a reason. The owner will see it.', false); return; }
    if (status === 'banned' && !confirm(`Ban ${site.name}? It goes offline and orders stop.`)) return;
    const cap = restrictions.product_cap;
    await run('site', { action: 'set_site_state', site_id: site.id, status, restrictions: { ...restrictions, product_cap: typeof cap === 'number' ? cap : null }, reason, admin_note: note, notify_owner: notify }, `${site.name} is now ${status}.`);
  };

  const saveUser = async () => {
    if (uStatus === 'banned') {
      if (!uReason.trim()) { onChanged('Add a reason for the ban.', false); return; }
      if (!confirm(`Ban ${site.owner_name}'s account? They cannot sign in, and all their sites go offline.`)) return;
    }
    await run('user', { action: 'set_user_state', user_id: site.owner_id, status: uStatus, max_sites_override: maxSites.trim() === '' ? null : Math.max(0, Number(maxSites) || 0), reason: uReason, admin_note: '' }, uStatus === 'banned' ? 'Account banned. Their sites are offline.' : 'Account saved.');
  };

  const grant = async () => {
    await run('plan', { action: 'grant_plan', site_id: site.id, tier, months: tier === 'free' ? 0 : months, reason: planReason }, `${site.name} is now on ${PLANS[tier].name}.`);
  };

  const toggle = (k: string) => setRestrictions((r) => ({ ...r, [k]: !r[k] }));
  const Btn = 'bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-10 rounded-full disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Control ${site.name}`}>
      <div className="w-full max-w-xl h-full overflow-y-auto bg-primary border-l border-theme p-6 space-y-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="g-h3 truncate">{site.name}</h3>
            <p className="text-sm text-secondary">{site.slug}.developa.me · owner {site.owner_name}</p>
          </div>
          <button onClick={onClose} className="h-9 px-4 rounded-full border border-theme hover:bg-hover text-sm">Close</button>
        </div>

        <section className="g-card p-5 space-y-4">
          <h4 className="font-medium">Site status</h4>
          <div className="grid sm:grid-cols-2 gap-2">
            {STATUSES.map((s) => (
              <button key={s.key} type="button" onClick={() => setStatus(s.key)} aria-pressed={status === s.key} className={`text-left rounded-xl border p-3 transition ${status === s.key ? 'border-accent ring-2 ring-accent/30' : 'border-theme hover:bg-hover'}`}>
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-secondary mt-0.5">{s.hint}</span>
              </button>
            ))}
          </div>

          <div>
            <p className={label}>Limits <span className="text-secondary font-normal">(work with any status except Active)</span></p>
            <div className="space-y-2">
              {RESTRICTION_LABELS.map((r) => (
                <label key={r.key} className="flex items-start gap-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!restrictions[r.key]} onChange={() => toggle(r.key)} className="w-4 h-4 mt-0.5" />
                  <span><span className="font-medium">{r.label}</span><span className="block text-xs text-secondary">{r.hint}</span></span>
                </label>
              ))}
              <div className="flex items-center gap-3 text-sm">
                <label htmlFor="cap" className="font-medium">Product limit</label>
                <input id="cap" type="number" min={0} value={typeof restrictions.product_cap === 'number' ? restrictions.product_cap : ''} onChange={(e) => setRestrictions((r) => ({ ...r, product_cap: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0) }))} placeholder="Plan limit" className="input-box w-28" />
                <span className="text-xs text-secondary">Lower than their plan allows</span>
              </div>
            </div>
          </div>

          <div><label className={label} htmlFor="reason">Reason <span className="text-secondary font-normal">(the owner sees this)</span></label><textarea id="reason" rows={2} maxLength={400} value={reason} onChange={(e) => setReason(e.target.value)} className="input-box w-full" placeholder="For example: selling items we do not allow" /></div>
          <div><label className={label} htmlFor="note">Private note <span className="text-secondary font-normal">(only admins see this)</span></label><textarea id="note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="input-box w-full" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="w-4 h-4" /> Tell the owner (bell and email)</label>
          <button type="button" onClick={saveSite} disabled={busy !== null} className={Btn}>{busy === 'site' ? 'Saving…' : 'Save site status'}</button>
        </section>

        <section className="g-card p-5 space-y-4">
          <h4 className="font-medium">Owner account <span className="text-secondary font-normal">· {site.owner_name}</span></h4>
          <div className="flex flex-wrap gap-2">
            {(['active', 'restricted', 'banned'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setUStatus(s)} aria-pressed={uStatus === s} className={`h-9 px-4 rounded-full text-sm border capitalize ${uStatus === s ? 'border-accent bg-accent/10 font-medium' : 'border-theme hover:bg-hover'}`}>{s}</button>
            ))}
          </div>
          <p className="text-xs text-secondary">Banned: cannot sign in and all their sites go offline. Restricted: they stay signed in but you can cap how many sites they run.</p>
          <div className="flex items-center gap-3 text-sm"><label htmlFor="maxsites" className="font-medium">Sites allowed</label><input id="maxsites" type="number" min={0} value={maxSites} onChange={(e) => setMaxSites(e.target.value)} placeholder="Plan limit" className="input-box w-28" /></div>
          <div><label className={label} htmlFor="ureason">Reason</label><input id="ureason" maxLength={400} value={uReason} onChange={(e) => setUReason(e.target.value)} className="input-box w-full" /></div>
          <button type="button" onClick={saveUser} disabled={busy !== null} className={Btn}>{busy === 'user' ? 'Saving…' : 'Save account'}</button>
        </section>

        <section className="g-card p-5 space-y-4">
          <h4 className="font-medium">Give or change a plan</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label} htmlFor="tier">Plan</label><select id="tier" value={tier} onChange={(e) => setTier(e.target.value as PlanTier)} className="input-box w-full">{PLAN_ORDER.map((t) => <option key={t} value={t}>{PLANS[t].name}</option>)}</select></div>
            <div><label className={label} htmlFor="months">Months</label><input id="months" type="number" min={1} max={36} disabled={tier === 'free'} value={months} onChange={(e) => setMonths(Math.max(1, Math.min(36, Number(e.target.value) || 1)))} className="input-box w-full" /></div>
          </div>
          <div><label className={label} htmlFor="preason">Why <span className="text-secondary font-normal">(kept in the history)</span></label><input id="preason" maxLength={300} value={planReason} onChange={(e) => setPlanReason(e.target.value)} className="input-box w-full" placeholder="Gift, partner, support fix…" /></div>
          <button type="button" onClick={grant} disabled={busy !== null} className={Btn}>{busy === 'plan' ? 'Saving…' : 'Apply plan'}</button>
        </section>

        <section className="g-card p-5 space-y-3">
          <h4 className="font-medium">History</h4>
          {history.length === 0 ? <p className="text-sm text-secondary">Nothing recorded for this site yet.</p> : (
            <ul className="divide-y divide-theme text-sm">
              {history.slice(0, 12).map((h) => (
                <li key={h.id} className="py-2">
                  <p><span className="font-medium">{h.action.replace(/_/g, ' ')}</span> <span className="text-secondary">by {h.admin_email || 'admin'}</span></p>
                  <p className="text-xs text-secondary">{new Date(h.created_at).toLocaleString('en-GB')}{typeof h.detail?.reason === 'string' && h.detail.reason ? ` · ${h.detail.reason}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
