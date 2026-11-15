'use client';

import { useEffect, useState } from 'react';
import { adminApi } from './adminApi';

interface Entry { id: string; action: string; admin_email: string | null; target_type: string; target_id: string | null; site_id: string | null; detail: Record<string, unknown>; created_at: string }

/** The trail of what every admin has done: status changes, bans, plan gifts, announcements. Newest first. */
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

  return (
    <div className="space-y-4">
      {needsUpdate && <p className="text-sm text-warning">Run the <span className="font-mono">platform_admin_controls</span> migration to start keeping this history.</p>}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the history" aria-label="Search the history" className="input-box w-full max-w-md" />
      {shown.length === 0 ? <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">Nothing here yet.</p> : (
        <div className="g-card overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="text-secondary border-b border-theme"><tr>{['When', 'What', 'Details', 'By'].map((h) => <th key={h} className="p-3.5 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-theme">
              {shown.map((e) => (
                <tr key={e.id}>
                  <td className="p-3.5 whitespace-nowrap text-secondary">{new Date(e.created_at).toLocaleString('en-GB')}</td>
                  <td className="p-3.5 font-medium capitalize">{e.action.replace(/_/g, ' ')}</td>
                  <td className="p-3.5 text-secondary">{summary(e) || e.target_type}</td>
                  <td className="p-3.5 text-secondary">{e.admin_email || 'admin'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
