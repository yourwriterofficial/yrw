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
  const [view, setView] = useState<'todo' | 'resolved' | 'all'>('todo');

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
  if (requests.length === 0) return <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">No priority support requests yet. Paying site owners send them from their dashboard.</p>;

  const todo = requests.filter((r) => r.status !== 'resolved').length;
  const shown = requests.filter((r) => (view === 'all' ? true : view === 'todo' ? r.status !== 'resolved' : r.status === 'resolved'));
  const STATUS_TONE: Record<SupportTicketRow['status'], string> = { open: 'bg-warning/10 text-warning', in_progress: 'bg-accent/10 text-accent', resolved: 'bg-success/10 text-success' };
  const STATUS_LABEL: Record<SupportTicketRow['status'], string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-secondary/60 border border-theme w-full sm:w-fit" role="group" aria-label="Show">
        {([['todo', `To do (${todo})`], ['resolved', 'Resolved'], ['all', 'All']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} aria-pressed={view === k} className={`h-9 px-4 rounded-lg text-sm font-semibold ${view === k ? 'bg-card shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}>{label}</button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">Nothing here.</p>}
      {shown.map((r) => {
        const d = drafts[r.id] || { status: r.status, reply: r.admin_reply || '' };
        return (
          <article key={r.id} className="bg-card border border-theme rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{r.subject}</p>
                <p className="text-xs text-secondary mt-0.5">
                  <a href={`/forums/${r.site_slug}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">{r.site_name}</a>
                  {' · '}{r.site_slug}.developa.me{r.whatsapp_number ? ` · WhatsApp ${r.whatsapp_number}` : ''} · {new Date(r.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                </p>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap rounded-xl bg-secondary/40 border border-theme p-3">{r.message}</p>
            <div className="space-y-2">
              <label htmlFor={`rp-${r.id}`} className="text-xs font-semibold text-secondary">Your reply (emailed to the owner)</label>
              <textarea
                id={`rp-${r.id}`}
                rows={2}
                value={d.reply}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: { ...d, reply: e.target.value } }))}
                placeholder="Write a reply…"
                className="w-full rounded-xl border border-theme bg-primary px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Status for ${r.subject}`}
                  value={d.status}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: { ...d, status: e.target.value as SupportTicketRow['status'] } }))}
                  className="h-9 rounded-lg border border-theme bg-card px-2.5 text-sm font-medium"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                <button type="button" disabled={busyId === r.id} onClick={() => saveReply(r.id)} className="h-9 px-5 rounded-lg bg-accent text-[var(--accent-foreground)] text-sm font-bold disabled:opacity-50">
                  {busyId === r.id ? 'Saving…' : 'Save and reply'}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
