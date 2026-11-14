'use client';

import { useCallback, useEffect, useState } from 'react';

interface SupportTicketRow {
  id: string;
  site_name: string;
  site_slug: string;
  subject: string;
  message: string;
  whatsapp_number: string;
  status: 'open' | 'in_progress' | 'resolved';
  admin_reply: string;
  created_at: string;
}

export default function SupportInboxTab({ flash }: { flash: (ok: boolean, text: string) => void }) {
  const [requests, setRequests] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { status: SupportTicketRow['status']; reply: string }>>({});
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/developa-support', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    setRequests(Array.isArray(data.requests) ? data.requests : []);
    setNeedsUpdate(!!data.needs_update);
    const init: Record<string, { status: SupportTicketRow['status']; reply: string }> = {};
    for (const r of data.requests || []) {
      init[r.id] = { status: r.status, reply: r.admin_reply || '' };
    }
    setDrafts(init);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (active) await load();
    })();
    return () => { active = false; };
  }, [load]);

  const saveReply = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    setBusyId(id);
    const res = await fetch('/api/admin/developa-support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: d.status, admin_reply: d.reply }),
    });
    const data = await res.json().catch(() => ({}));
    flash(res.ok, res.ok ? 'Support ticket updated and owner notified.' : data.error || 'Could not update ticket.');
    setBusyId('');
    if (res.ok) await load();
  };

  if (loading) return <p className="text-sm text-secondary">Loading priority requests…</p>;
  if (needsUpdate) {
    return (
      <p className="text-sm text-warning border border-warning/30 rounded-xl p-4">
        Priority support requires migration <span className="font-mono">20261114040000_growth_and_scale.sql</span>.
      </p>
    );
  }
  if (requests.length === 0) return <p className="text-sm text-secondary">No priority support requests yet.</p>;

  return (
    <div className="space-y-4">
      {requests.map((r) => {
        const d = drafts[r.id] || { status: r.status, reply: r.admin_reply || '' };
        return (
          <div key={r.id} className="g-card p-5 space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{r.subject} · <span className="text-accent">{r.site_name}</span></p>
                <p className="text-xs text-secondary">
                  {r.site_slug}.developa.me{r.whatsapp_number ? ` · WhatsApp: ${r.whatsapp_number}` : ''} · {new Date(r.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <select
                aria-label={`Status for ${r.subject}`}
                value={d.status}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: { ...d, status: e.target.value as SupportTicketRow['status'] } }))}
                className="input-box !py-1.5 text-xs"
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <p className="text-sm text-primary whitespace-pre-wrap">{r.message}</p>
            <div className="flex flex-wrap gap-2 items-center pt-1">
              <input
                value={d.reply}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: { ...d, reply: e.target.value } }))}
                placeholder="Write a reply to email to the store owner…"
                aria-label="Reply to store owner"
                className="input-box flex-1 min-w-[220px] !py-2 text-xs"
              />
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => saveReply(r.id)}
                className="px-4 h-9 rounded-full bg-accent text-[var(--accent-foreground)] text-xs font-medium disabled:opacity-50"
              >
                {busyId === r.id ? 'Saving…' : 'Update & reply'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
