'use client';

import { useCallback, useEffect, useState } from 'react';
import { PLANS, PLAN_ORDER, type PlanTier } from '@/lib/plans';
import { adminApi } from './adminApi';

interface SiteLite { id: string; name: string; slug: string }
interface AnnouncementRow { status?: 'scheduled' | 'sent' | 'cancelled'; send_at?: string | null; id: string; title: string; body: string; level: string; audience: { type: string; tiers?: string[]; site_ids?: string[]; status?: string }; channels: string[]; pinned: boolean; expires_at: string | null; recipient_count: number; created_at: string }

type AudienceType = 'all' | 'tiers' | 'sites' | 'status';
const LEVELS = [
  { key: 'info', label: 'News', hint: 'Normal update' },
  { key: 'success', label: 'Good news', hint: 'New feature, offer' },
  { key: 'warning', label: 'Heads up', hint: 'Something they should act on' },
  { key: 'critical', label: 'Important', hint: 'Account or safety. Also emailed to people who opted out.' },
] as const;

const describe = (a: AnnouncementRow['audience']) =>
  a.type === 'all' ? 'Every site owner'
  : a.type === 'tiers' ? `Plans: ${(a.tiers || []).map((t) => PLANS[t as PlanTier]?.name || t).join(', ')}`
  : a.type === 'sites' ? `${(a.site_ids || []).length} chosen site(s)`
  : `Sites that are ${a.status}`;

/**
 * Write once, reach owners in up to three places: their dashboard inbox, the notification bell (with a phone alert
 * if they allow it) and email. Pick everyone, certain plans, chosen sites or sites under a restriction.
 */
export default function AnnounceTab({ sites, flash }: { sites: SiteLite[]; flash: (ok: boolean, t: string) => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [level, setLevel] = useState<(typeof LEVELS)[number]['key']>('info');
  const [audienceType, setAudienceType] = useState<AudienceType>('all');
  const [tiers, setTiers] = useState<PlanTier[]>(['free']);
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [statusAud, setStatusAud] = useState<'restricted' | 'suspended' | 'banned'>('restricted');
  const [channels, setChannels] = useState<string[]>(['inbox', 'bell']);
  const [pinned, setPinned] = useState(false);
  const [expires, setExpires] = useState('');
  const [sendAt, setSendAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [reach, setReach] = useState<string>('');
  const [history, setHistory] = useState<AnnouncementRow[]>([]);
  const [needsUpdate, setNeedsUpdate] = useState(false);

  const load = useCallback(async () => {
    const r = await adminApi<{ announcements?: AnnouncementRow[]; needs_update?: boolean }>('/api/admin/developa-announce');
    setHistory(r.data.announcements || []);
    setNeedsUpdate(!!r.data.needs_update);
  }, []);
  useEffect(() => { let a = true; (async () => { await Promise.resolve(); if (a) await load(); })(); return () => { a = false; }; }, [load]);

  const audience = () =>
    audienceType === 'all' ? { type: 'all' }
    : audienceType === 'tiers' ? { type: 'tiers', tiers }
    : audienceType === 'sites' ? { type: 'sites', site_ids: siteIds }
    : { type: 'status', status: statusAud };

  const payload = (dry: boolean) => ({
    title, body, level, audience: audience(), channels, pinned,
    expires_at: expires ? new Date(expires + 'T23:59:59').toISOString() : null,
    send_at: sendAt ? new Date(sendAt).toISOString() : null, dry_run: dry,
  });

  const check = async () => {
    setReach('Checking…');
    const r = await adminApi<{ owners?: number; sites?: number; error?: string }>('/api/admin/developa-announce', 'POST', payload(true));
    setReach(r.ok ? `${r.data.owners} owner(s), ${r.data.sites} site(s) would get this.` : (r.data.error as string) || 'Could not check.');
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const later = sendAt && new Date(sendAt).getTime() > Date.now() + 2 * 60_000;
    if (!confirm(later ? `Schedule "${title}" for ${new Date(sendAt).toLocaleString('en-GB')}?` : `Send "${title}" now? This cannot be taken back (you can remove it from the inbox afterwards).`)) return;
    setBusy(true);
    const r = await adminApi<{ owners?: number; bell?: number; emailed?: number; emailSkipped?: number; truncated?: boolean; scheduled?: boolean; error?: string }>('/api/admin/developa-announce', 'POST', payload(false));
    setBusy(false);
    if (r.ok && r.data.scheduled) {
      flash(true, `Scheduled for ${new Date(sendAt).toLocaleString('en-GB')}. It goes out then, to the owners who match at that time.`);
      setTitle(''); setBody(''); setReach(''); setSendAt('');
      await load();
    } else if (r.ok) {
      const d = r.data;
      flash(true, `Sent to ${d.owners} owner(s)${channels.includes('bell') ? `, ${d.bell} bell` : ''}${channels.includes('email') ? `, ${d.emailed} emailed${d.emailSkipped ? ` (${d.emailSkipped} skipped: opted out or no address)` : ''}` : ''}${d.truncated ? '. Only the first 1,000 owners were included.' : '.'}`);
      setTitle(''); setBody(''); setReach('');
      await load();
    } else flash(false, (r.data.error as string) || 'Could not send.');
  };

  const remove = async (a: AnnouncementRow) => {
    if (!confirm(`Remove "${a.title}" from owners' inboxes?`)) return;
    await adminApi(`/api/admin/developa-announce?id=${a.id}`, 'DELETE');
    await load();
  };

  const toggleCh = (c: string) => setChannels((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  const toggleTier = (t: PlanTier) => setTiers((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  const label = 'block text-sm font-medium mb-1.5';
  const chip = (on: boolean) => `h-9 px-4 rounded-full text-sm border ${on ? 'border-accent bg-accent/10 font-medium' : 'border-theme hover:bg-hover'}`;
  const noChannel = channels.length === 0;

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <form onSubmit={send} className="lg:col-span-3 g-card p-5 space-y-5 h-fit">
        <h3 className="font-medium">Send an announcement</h3>
        {needsUpdate && <p className="text-sm text-warning">Run the <span className="font-mono">platform_admin_controls</span> migration first. Without it the inbox cannot store announcements.</p>}

        <div><label className={label} htmlFor="an-t">Title</label><input id="an-t" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className="input-box w-full" placeholder="New: sell tickets on your site" /></div>
        <div><label className={label} htmlFor="an-b">Message</label><textarea id="an-b" required rows={5} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} className="input-box w-full" placeholder="Write it plainly. Leave a blank line between paragraphs." /></div>

        <div>
          <p className={label}>Type</p>
          <div className="flex flex-wrap gap-2">{LEVELS.map((l) => <button type="button" key={l.key} onClick={() => setLevel(l.key)} aria-pressed={level === l.key} title={l.hint} className={chip(level === l.key)}>{l.label}</button>)}</div>
          <p className="text-xs text-secondary mt-1.5">{LEVELS.find((l) => l.key === level)?.hint}</p>
        </div>

        <div>
          <p className={label}>Who gets it</p>
          <div className="flex flex-wrap gap-2">
            {([['all', 'Everyone'], ['tiers', 'By plan'], ['sites', 'Chosen sites'], ['status', 'Sites under a limit']] as [AudienceType, string][]).map(([k, l]) => <button type="button" key={k} onClick={() => setAudienceType(k)} aria-pressed={audienceType === k} className={chip(audienceType === k)}>{l}</button>)}
          </div>
          {audienceType === 'tiers' && <div className="flex flex-wrap gap-2 mt-3">{PLAN_ORDER.map((t) => <button type="button" key={t} onClick={() => toggleTier(t)} aria-pressed={tiers.includes(t)} className={chip(tiers.includes(t))}>{PLANS[t].name}</button>)}</div>}
          {audienceType === 'status' && <select value={statusAud} onChange={(e) => setStatusAud(e.target.value as typeof statusAud)} className="input-box mt-3"><option value="restricted">Restricted</option><option value="suspended">Suspended</option><option value="banned">Banned</option></select>}
          {audienceType === 'sites' && (
            <select multiple value={siteIds} onChange={(e) => setSiteIds(Array.from(e.target.selectedOptions).map((o) => o.value))} className="input-box w-full mt-3 h-40" aria-label="Choose sites">
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.slug})</option>)}
            </select>
          )}
        </div>

        <div>
          <p className={label}>Where it shows</p>
          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-3"><input type="checkbox" checked={channels.includes('inbox')} onChange={() => toggleCh('inbox')} className="w-4 h-4 mt-0.5" /><span><span className="font-medium">Dashboard inbox</span><span className="block text-xs text-secondary">A message on their dashboard until they close it.</span></span></label>
            <label className="flex items-start gap-3"><input type="checkbox" checked={channels.includes('bell')} onChange={() => toggleCh('bell')} className="w-4 h-4 mt-0.5" /><span><span className="font-medium">Notification bell</span><span className="block text-xs text-secondary">Also a phone alert if they switched alerts on.</span></span></label>
            <label className="flex items-start gap-3"><input type="checkbox" checked={channels.includes('email')} onChange={() => toggleCh('email')} className="w-4 h-4 mt-0.5" /><span><span className="font-medium">Email</span><span className="block text-xs text-secondary">Owners who turned off admin emails are skipped, except for “Important”.</span></span></label>
          </div>
          {channels.includes('inbox') && (
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="w-4 h-4" /> Keep it on top of their dashboard</label>
              <label className="flex items-center gap-2">Remove on <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="input-box" /></label>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm w-full">Send later <input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} className="input-box" /><span className="text-xs text-secondary">{sendAt ? '' : 'Leave empty to send now'}</span></label>
          <button type="button" onClick={check} disabled={noChannel} className="h-10 px-5 rounded-full border border-theme hover:bg-hover text-sm disabled:opacity-50">Check who gets this</button>
          <button type="submit" disabled={busy || noChannel} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-7 h-10 rounded-full disabled:opacity-50">{busy ? 'Working…' : sendAt && new Date(sendAt).getTime() > Date.now() + 2 * 60_000 ? 'Schedule' : 'Send'}</button>
          {reach && <span className="text-sm text-secondary" role="status">{reach}</span>}
        </div>
      </form>

      <div className="lg:col-span-2 space-y-3">
        <h3 className="font-medium">Sent so far</h3>
        {history.length === 0 && <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">Nothing sent yet.</p>}
        {history.map((a) => (
          <div key={a.id} className="g-card p-4 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium min-w-0">{a.title}{a.pinned && <span className="ml-2 text-xs text-secondary font-normal">pinned</span>}</p>
              <button onClick={() => remove(a)} className="text-xs text-danger hover:underline shrink-0">{a.status === 'scheduled' ? 'Cancel' : 'Remove'}</button>
            </div>
            <p className="text-sm text-secondary line-clamp-2">{a.body}</p>
            <p className="text-xs text-secondary">{a.status === 'scheduled' ? <span className="text-warning font-medium">Scheduled for {a.send_at ? new Date(a.send_at).toLocaleString('en-GB') : 'later'} · </span> : a.status === 'cancelled' ? <span className="font-medium">Cancelled · </span> : null}{describe(a.audience)} · {a.status === 'scheduled' ? 'not sent yet' : `${a.recipient_count} owner(s)`} · {a.channels.join(', ')} · {new Date(a.created_at).toLocaleDateString('en-GB')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
