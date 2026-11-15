'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './adminApi';

interface Report {
  id: string; site_id: string; site_name: string; site_slug: string; owner_id: string | null;
  target_type: 'site' | 'product' | 'thread'; target_id: string | null; target_title: string | null;
  reason: string; details: string; reporter_email: string; status: 'open' | 'reviewing' | 'actioned' | 'dismissed';
  resolution: string; created_at: string; open_for_site: number;
}

const REASON_LABEL: Record<string, string> = { scam: 'Scam or fraud', counterfeit: 'Counterfeit', illegal: 'Illegal or dangerous', abuse: 'Abusive', spam: 'Spam', other: 'Other' };
const FILTERS = [['open', 'Open'], ['reviewing', 'Looking into'], ['actioned', 'Dealt with'], ['dismissed', 'Dismissed'], ['', 'All']] as const;

/**
 * Reports sent by buyers and visitors. For each one the admin can dismiss it, mark it as being looked into, take the
 * reported item down, or open the site's controls to restrict or suspend it.
 */
export default function ReportsTab({ flash, openSite }: { flash: (ok: boolean, t: string) => void; openSite: (siteId: string) => void }) {
  const [filter, setFilter] = useState<string>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await adminApi<{ reports?: Report[]; needs_update?: boolean }>(`/api/admin/developa-reports${filter ? `?status=${filter}` : ''}`);
    setReports(r.data.reports || []);
    setNeedsUpdate(!!r.data.needs_update);
  }, [filter]);
  useEffect(() => { let a = true; (async () => { await Promise.resolve(); if (a) await load(); })(); return () => { a = false; }; }, [load]);

  const setStatus = async (rp: Report, status: Report['status'], resolution = '') => {
    setBusy(rp.id);
    const r = await adminApi('/api/admin/developa-reports', 'PATCH', { id: rp.id, status, resolution });
    setBusy(null);
    flash(r.ok, r.ok ? 'Report updated.' : (r.data.error as string) || 'Could not update.');
    await load();
  };

  const takeDown = async (rp: Report) => {
    if (rp.target_type === 'site' || !rp.target_id) return;
    const reason = prompt(`Why is this being removed? The owner will see it.\n\n"${rp.target_title || 'This item'}"`, REASON_LABEL[rp.reason] || '');
    if (reason === null) return;
    setBusy(rp.id);
    const r = await adminApi('/api/admin/developa-moderation', 'POST', { action: 'remove', site_id: rp.site_id, item_type: rp.target_type, item_id: rp.target_id, reason, report_id: rp.id });
    setBusy(null);
    flash(r.ok, r.ok ? 'Removed, and the owner was told.' : (r.data.error as string) || 'Could not remove it.');
    await load();
  };

  return (
    <div className="space-y-4">
      {needsUpdate && <p className="text-sm text-warning">Run the <span className="font-mono">reports_scheduling_ad_stats</span> migration to start collecting reports.</p>}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => <button key={l} onClick={() => setFilter(k)} aria-pressed={filter === k} className={`h-9 px-4 rounded-full text-sm border ${filter === k ? 'border-accent bg-accent/10 font-medium' : 'border-theme hover:bg-hover'}`}>{l}</button>)}
      </div>
      {reports.length === 0 ? <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">No reports here.</p> : (
        <div className="space-y-3">
          {reports.map((rp) => (
            <article key={rp.id} className="g-card p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{REASON_LABEL[rp.reason] || rp.reason} <span className="text-secondary font-normal">· {rp.target_type === 'site' ? 'the store' : rp.target_type === 'product' ? 'an item' : 'a post'}</span></p>
                  <p className="text-sm text-secondary">
                    <a href={`/forums/${rp.site_slug}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">{rp.site_name}</a>
                    {rp.target_title && <> · “{rp.target_title}”</>}
                    {rp.open_for_site > 1 && <span className="text-warning"> · {rp.open_for_site} open reports on this site</span>}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border ${rp.status === 'open' ? 'border-warning/40 text-warning' : 'border-theme text-secondary'}`}>{rp.status === 'reviewing' ? 'looking into' : rp.status}</span>
              </div>
              {rp.details && <p className="text-sm whitespace-pre-line">{rp.details}</p>}
              <p className="text-xs text-secondary">{new Date(rp.created_at).toLocaleString('en-GB')}{rp.reporter_email ? ` · ${rp.reporter_email}` : ' · anonymous'}{rp.resolution ? ` · ${rp.resolution}` : ''}</p>
              <div className="flex flex-wrap gap-2">
                {rp.status !== 'reviewing' && rp.status !== 'actioned' && <button disabled={busy === rp.id} onClick={() => setStatus(rp, 'reviewing')} className="px-3 h-8 rounded-full border border-theme text-xs">Looking into it</button>}
                {rp.target_type !== 'site' && rp.target_id && rp.status !== 'actioned' && <button disabled={busy === rp.id} onClick={() => takeDown(rp)} className="px-3 h-8 rounded-full bg-danger text-white text-xs font-medium">Take it down</button>}
                <button onClick={() => openSite(rp.site_id)} className="px-3 h-8 rounded-full border border-accent text-accent text-xs font-medium">Open site controls</button>
                {rp.status !== 'dismissed' && rp.status !== 'actioned' && <button disabled={busy === rp.id} onClick={() => { const note = prompt('Why is this being dismissed? (kept in the history)', 'Not a problem'); if (note !== null) void setStatus(rp, 'dismissed', note); }} className="px-3 h-8 rounded-full border border-theme text-xs">Dismiss</button>}
                {(rp.status === 'dismissed' || rp.status === 'actioned') && <button disabled={busy === rp.id} onClick={() => setStatus(rp, 'open')} className="px-3 h-8 rounded-full border border-theme text-xs">Reopen</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
