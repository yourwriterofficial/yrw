'use client';

import { useEffect, useState } from 'react';
import { adminApi } from './adminApi';

interface Entry { id: string; action: string; admin_email: string | null; target_type: string; target_id: string | null; site_id: string | null; detail: Record<string, unknown>; created_at: string }

/** A colour for the kind of change, so the trail can be scanned: red for removals and bans, green for things restored or sent. */
function tone(action: string) {
  if (/ban|remove|delete|suspend|limit|restrict|takedown|reject/.test(action)) return 'bg-danger/10 text-danger';
  if (/restor|unban|sent|approve|verify|grant|gift|live|lift/.test(action)) return 'bg-success/10 text-success';
  return 'bg-accent/10 text-accent';
}

/** The trail of what every admin has done: status changes, bans, plan gifts, announcements. Newest first, grouped by day. */
export default function AuditTab() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    let a = true;
    adminApi<{ entries?: Entry[]; needs_update?: boolean }>('/api/admin/developa-audit').then((r) => { if (a) { setEntries(r.data.entries || []); setNeedsUpdate(!!r.data.needs_update); } });
    return () => { a = false; };
  }, []);

  const shown = entries.filter((e) => !q.trim() || JSON.stringify(e).toLowerCase().includes(q.trim().toLowerCase()));
  const summary = (e: Entry) => {
    const d = e.detail || {};
    const bits = [typeof d.name === 'string' ? d.name : '', typeof d.title === 'string' ? d.title : '', typeof d.tier === 'string' ? `plan ${d.tier}` : '', typeof d.reason === 'string' ? d.reason : ''].filter(Boolean);
    return bits.join(' · ');
  };

  const days: { label: string; items: Entry[] }[] = [];
  for (const e of shown) {
    const label = new Date(e.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(e);
    else days.push({ label, items: [e] });
  }

  return (
    <div className="space-y-4">
      {needsUpdate && <p className="text-sm text-warning">Run the <span className="font-mono">platform_admin_controls</span> migration to start keeping this history.</p>}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the history" aria-label="Search the history" className="h-10 w-full max-w-md rounded-xl border border-theme bg-card px-3 text-sm" />
      {days.length === 0 ? <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">Nothing here yet.</p> : (
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d.label}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-2">{d.label}</h3>
              <ul className="bg-card border border-theme rounded-2xl divide-y divide-theme overflow-hidden">
                {d.items.map((e) => (
                  <li key={e.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md capitalize shrink-0 ${tone(e.action)}`}>{e.action.replace(/_/g, ' ')}</span>
                    <p className="min-w-0 flex-1 basis-48 text-sm truncate">{summary(e) || e.target_type}</p>
                    <p className="text-xs text-secondary shrink-0 text-right">
                      {e.admin_email || 'admin'} · {new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
