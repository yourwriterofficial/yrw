'use client';

import { useState, useEffect, useCallback } from 'react';
import * as lucide from 'lucide-react';
import { showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';
import Button from '@/app/components/ui/Button';
import { supabase } from '@/lib/supabaseClient';
// Preview through the exact shell the server sends with — a second local copy
// of the template drifted and showed admins something they never actually sent.
import { emailShell } from '@/lib/emailTemplates';

type AdminUser = { id: string; full_name: string; email: string };
type MassLog = { id: number; subject: string; recipient_count: number; all_users: boolean; sent_at: string };
type Tab = 'notify' | 'email';
type Audience = 'all' | 'selected';

export default function EmailNotificationsPage() {
  const [tab, setTab] = useState<Tab>('notify');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Shared targeting
  const [audience, setAudience] = useState<Audience>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Notification composer
  const [message, setMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // Email composer
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Email preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');

  // Prune
  const [pruning, setPruning] = useState(false);

  // Mass-send audit log
  const [massLogs, setMassLogs] = useState<MassLog[]>([]);
  const fetchMassLogs = useCallback(async () => {
    const { data } = await supabase
      .from('mass_notification_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(20);
    setMassLogs(data || []);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok && Array.isArray(data.users)) {
        setUsers(
          data.users.map((u: any) => ({
            id: u.id,
            full_name: u.full_name || '',
            email: u.email || '',
          }))
        );
      } else {
        showToast(data.error || 'Failed to load users', 'error');
      }
    } catch {
      showToast('Network error loading users', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchMassLogs();
  }, [fetchUsers, fetchMassLogs]);

  const recipientCount = audience === 'all' ? users.length : selectedIds.length;

  const targetingPayload = () =>
    audience === 'all'
      ? { allUsers: true }
      : { userIds: selectedIds };

  const sendNotification = async () => {
    if (!message.trim()) return showToast('Enter a notification message.', 'error');
    if (recipientCount === 0) return showToast('No recipients selected.', 'error');
    setSendingNotif(true);
    try {
      const res = await fetch('/api/admin/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), ...targetingPayload() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Notification pushed to ${data.count} ${data.count === 1 ? 'user' : 'users'}`, 'success');
        setMessage('');
        setSelectedIds([]);
      } else {
        showToast(data.error || 'Failed to send notification', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSendingNotif(false);
    }
  };

  const sendEmail = async () => {
    if (!subject.trim() || !html.trim()) return showToast('Subject and body are required.', 'error');
    if (recipientCount === 0) return showToast('No recipients selected.', 'error');
    setSendingEmail(true);
    try {
      const res = await fetch('/api/admin/send-mass-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, html, ...targetingPayload() }),
      });
      const data = await res.json();
      if (res.ok) {
        const emailed = data.emailed ?? data.sentCount ?? recipientCount;
        const skipped = (data.optedOut ?? 0) + (data.failed ?? 0);
        showToast(
          skipped > 0
            ? `Emailed ${emailed} of ${data.sentCount} — ${skipped} skipped (opted out or undeliverable). All got the in-app alert.`
            : `Email sent to ${emailed} ${emailed === 1 ? 'user' : 'users'}`,
          skipped > 0 ? 'info' : 'success'
        );
        setSubject('');
        setHtml('');
        setSelectedIds([]);
        fetchMassLogs();
      } else {
        showToast(data.error || 'Failed to send email', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const prune = async (body: Record<string, unknown>, label: string) => {
    if (!confirm(`${label}? This permanently deletes notifications and cannot be undone.`)) return;
    setPruning(true);
    try {
      const res = await fetch('/api/admin/prune-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) showToast(`Pruned ${data.deleted} notification${data.deleted === 1 ? '' : 's'}`, 'success');
      else showToast(data.error || 'Prune failed', 'error');
    } catch {
      showToast('Network error', 'error');
    } finally {
      setPruning(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <div className="h-8 w-48 skeleton mb-3" />
        <div className="h-3 w-80 max-w-full skeleton mb-8" />
        <div className="h-72 w-full skeleton rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl space-y-6">
      <PageHeader
        title="Messaging"
        description="Send a short notice to people's notification bell, or an email, to everyone with an account or just a few."
        icon={<lucide.Send className="w-7 h-7 text-accent" />}
      />

      {/* How to send */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-secondary/60 border border-theme w-full sm:w-fit" role="tablist">
        <TabButton active={tab === 'notify'} onClick={() => setTab('notify')} icon={<lucide.Bell className="w-4 h-4" />}>
          Bell notice
        </TabButton>
        <TabButton active={tab === 'email'} onClick={() => setTab('email')} icon={<lucide.Mail className="w-4 h-4" />}>
          Email
        </TabButton>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* Step 1 */}
          <section className="bg-card border border-theme rounded-2xl p-5 space-y-4">
            <h2 className="font-bold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-accent text-[var(--accent-foreground)] text-xs font-black flex items-center justify-center">1</span> Who gets it</h2>
            <RecipientSelector users={users} audience={audience} setAudience={setAudience} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
          </section>

          {/* Step 2 */}
          <section className="bg-card border border-theme rounded-2xl p-5 space-y-4">
            <h2 className="font-bold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-accent text-[var(--accent-foreground)] text-xs font-black flex items-center justify-center">2</span> {tab === 'notify' ? 'Write the notice' : 'Write the email'}</h2>
            {tab === 'notify' ? (
              <div>
                <label htmlFor="ms-note" className="text-xs font-semibold text-secondary block mb-1">Message (appears in the bell)</label>
                <textarea id="ms-note" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={280} className="w-full bg-primary border border-theme rounded-xl p-4 h-28 text-sm text-primary focus:border-accent outline-none resize-none" placeholder="e.g. Your order is ready for review in your dashboard." />
                <p className="text-[11px] text-secondary text-right mt-1">{message.length}/280</p>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="ms-sub" className="text-xs font-semibold text-secondary block mb-1">Subject</label>
                  <input id="ms-sub" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full h-11 bg-primary border border-theme rounded-xl px-4 text-sm focus:border-accent outline-none text-primary font-semibold" placeholder="Important update about your account" />
                </div>
                <div>
                  <label htmlFor="ms-html" className="text-xs font-semibold text-secondary block mb-1">Message (HTML is allowed)</label>
                  <textarea id="ms-html" value={html} onChange={(e) => setHtml(e.target.value)} className="w-full bg-primary border border-theme rounded-xl p-4 h-52 font-mono text-xs text-primary focus:border-accent outline-none resize-y" placeholder="<h2>Hello,</h2><p>We have an update for you...</p>" />
                  <p className="text-[11px] text-secondary mt-1">The email is wrapped in the standard design automatically. Use Preview to see it.</p>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Send summary */}
        <aside className="bg-card border border-theme rounded-2xl p-5 space-y-4 xl:sticky xl:top-4">
          <h2 className="font-bold">Ready to send</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between gap-3"><dt className="text-secondary">How</dt><dd className="font-semibold">{tab === 'notify' ? 'Bell notice' : 'Email + bell'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-secondary">To</dt><dd className="font-semibold">{audience === 'all' ? 'Everyone' : 'Chosen people'} · {recipientCount}</dd></div>
          </dl>
          {recipientCount === 0 && <p className="text-xs text-warning">Choose at least one person.</p>}
          {tab === 'notify' ? (
            <Button onClick={sendNotification} disabled={sendingNotif || !message.trim() || recipientCount === 0} loading={sendingNotif} loadingText="Sending..." size="lg" fullWidth>
              <lucide.Bell className="w-4 h-4" /> Send notice
            </Button>
          ) : (
            <div className="space-y-2">
              <Button variant="secondary" size="md" fullWidth onClick={() => { setPreviewSubject(subject || 'No subject yet'); setPreviewHtml(html || '<p style="color:#666">Write the message first to preview it here.</p>'); setPreviewOpen(true); }}>
                <lucide.Eye className="w-4 h-4" /> Preview
              </Button>
              <Button onClick={sendEmail} disabled={sendingEmail || !subject.trim() || !html.trim() || recipientCount === 0} loading={sendingEmail} loadingText="Sending..." size="lg" fullWidth>
                <lucide.Send className="w-4 h-4" /> Send email
              </Button>
            </div>
          )}
          <p className="text-[11px] text-secondary">People who turned off marketing email still get the bell notice. Sends are logged below.</p>
        </aside>
      </div>

      {/* Mass-send history */}
      <section className="bg-card border border-theme rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-theme flex items-center gap-2">
          <lucide.ScrollText className="w-4 h-4 text-accent" />
          <h2 className="font-bold">Recent sends</h2>
        </div>
        {massLogs.length === 0 ? (
          <p className="p-6 text-sm text-secondary">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-theme">
            {massLogs.map((log) => (
              <li key={log.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><lucide.Mail className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-sm font-semibold truncate">{log.subject}</p>
                  <p className="text-xs text-secondary">{new Date(log.sent_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-accent/10 text-accent shrink-0">
                  {log.recipient_count} {log.recipient_count === 1 ? 'person' : 'people'}{log.all_users ? ' · everyone' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Housekeeping */}
      <details className="bg-card border border-theme rounded-2xl group">
        <summary className="px-5 py-4 cursor-pointer list-none flex items-center gap-2 font-bold">
          <lucide.Trash2 className="w-4 h-4 text-danger" /> Clean up old notifications
          <lucide.ChevronDown className="w-4 h-4 ml-auto text-secondary transition group-open:rotate-180" />
        </summary>
        <div className="px-5 pb-5 space-y-3">
          <p className="text-xs text-secondary max-w-2xl">Removes old notices from everyone&apos;s bell. Emails already sent are not affected, and this cannot be undone.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => prune({ olderThanDays: 30 }, 'Delete notifications older than 30 days')} disabled={pruning}>
              <lucide.Clock className="w-4 h-4" /> Older than 30 days
            </Button>
            <Button variant="secondary" size="sm" onClick={() => prune({ olderThanDays: 7 }, 'Delete notifications older than 7 days')} disabled={pruning}>
              <lucide.Clock className="w-4 h-4" /> Older than 7 days
            </Button>
            <button onClick={() => prune({ all: true }, 'Delete ALL notifications')} disabled={pruning} className="h-8 px-4 rounded-full border border-danger/30 text-danger hover:bg-danger/10 text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50">
              <lucide.Trash2 className="w-3.5 h-3.5" /> Clear everything
            </button>
          </div>
        </div>
      </details>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-primary border border-theme rounded-[32px] p-6 md:p-8 max-w-2xl w-full shadow-2xl flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-black text-primary">Branded Email Preview</h3>
                <p className="text-xs text-secondary mt-0.5">Subject: {previewSubject}</p>
              </div>
              <button 
                onClick={() => setPreviewOpen(false)} 
                className="w-10 h-10 rounded-full bg-secondary hover:bg-hover text-primary flex items-center justify-center transition cursor-pointer"
              >
                <lucide.X className="w-4 h-4" />
              </button>
            </div>
            <div className="border border-theme/30 rounded-2xl overflow-hidden flex-1 bg-primary">
              <iframe
                srcDoc={emailShell(previewHtml)}
                className="w-full h-full bg-primary border-0"
                title="Branded Email Broadcast Preview"
              />
            </div>
            <div className="flex justify-end gap-3 mt-4 shrink-0">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setPreviewOpen(false)}
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-9 px-5 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 transition ${
        active ? 'bg-card shadow-sm text-primary' : 'text-secondary hover:text-primary'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function RecipientSelector({
  users,
  audience,
  setAudience,
  selectedIds,
  setSelectedIds,
}: {
  users: AdminUser[];
  audience: Audience;
  setAudience: (a: Audience) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const shown = users.filter((u) => {
    const t = q.trim().toLowerCase();
    return !t || u.full_name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t);
  });
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <AudienceRadio active={audience === 'all'} onClick={() => setAudience('all')}>
          Everyone with an account ({users.length})
        </AudienceRadio>
        <AudienceRadio active={audience === 'selected'} onClick={() => setAudience('selected')}>
          Choose people{audience === 'selected' && selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
        </AudienceRadio>
      </div>

      {audience === 'selected' && (
        <div className="mt-4 border border-theme rounded-xl bg-primary overflow-hidden">
          <div className="p-2 border-b border-theme flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <lucide.Search className="w-4 h-4 text-secondary absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search people" className="w-full h-9 rounded-lg border border-theme bg-card pl-8 pr-2 text-sm" />
            </div>
            <button type="button" onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...shown.map((u) => u.id)])))} className="h-9 px-3 rounded-lg border border-theme hover:bg-hover text-xs font-semibold">Pick shown</button>
            <button type="button" onClick={() => setSelectedIds([])} className="h-9 px-3 rounded-lg border border-theme hover:bg-hover text-xs font-semibold">Clear</button>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {shown.length === 0 ? (
              <p className="text-xs text-secondary p-4 text-center">{users.length === 0 ? 'No users found.' : 'No one matches.'}</p>
            ) : (
              shown.map((user) => {
                const checked = selectedIds.includes(user.id);
                return (
                  <label key={user.id} className="flex items-center gap-3 py-2 px-2 text-sm text-primary cursor-pointer hover:bg-hover rounded-lg transition">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setSelectedIds(e.target.checked ? [...selectedIds, user.id] : selectedIds.filter((id) => id !== user.id))}
                      className="accent-accent w-4 h-4 shrink-0"
                    />
                    <span className="font-semibold truncate">{user.full_name || 'No name'}</span>
                    <span className="text-secondary text-xs truncate ml-auto">{user.email}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AudienceRadio({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-xl px-4 h-11 text-sm font-semibold transition cursor-pointer border ${
        active ? 'border-accent bg-accent/10 text-primary' : 'border-theme bg-primary text-secondary hover:border-accent/50'
      }`}
    >
      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-accent' : 'border-current'}`}>
        {active && <span className="w-2 h-2 rounded-full bg-accent" />}
      </span>
      {children}
    </button>
  );
}

function Spinner() {
  return <div className="w-3.5 h-3.5 border-2 border-[var(--accent-foreground)]/30 border-t-[var(--accent-foreground)] rounded-full animate-spin" />;
}
