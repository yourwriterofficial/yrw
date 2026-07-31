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
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">

      <PageHeader
        title="Messaging Center"
        description="Push in-app notifications to the bell or broadcast HTML emails — to everyone or a selected few."
        breadcrumb="Admin / Messaging"
        icon={<lucide.Send className="w-8 h-8 text-accent" />}
      />

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-secondary border border-theme rounded-2xl w-fit">
        <TabButton active={tab === 'notify'} onClick={() => setTab('notify')} icon={<lucide.Bell className="w-4 h-4" />}>
          In-App Notification
        </TabButton>
        <TabButton active={tab === 'email'} onClick={() => setTab('email')} icon={<lucide.Mail className="w-4 h-4" />}>
          Email Broadcast
        </TabButton>
      </div>

      <div className="bg-secondary border border-theme rounded-3xl p-6 md:p-8 space-y-6 shadow-card">
        {/* Recipient targeting (shared) */}
        <RecipientSelector
          users={users}
          audience={audience}
          setAudience={setAudience}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
        />

        <div className="h-px bg-[var(--border)]" />

        {tab === 'notify' ? (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase font-black tracking-widest text-secondary block ml-1 mb-2">
                Notification Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={280}
                className="w-full bg-primary border border-theme rounded-xl p-4 h-28 text-sm text-primary focus:border-accent outline-none resize-none"
                placeholder="e.g. Your order is ready for review in your dashboard."
              />
              <p className="text-[10px] text-secondary text-right mt-1 mr-1">{message.length}/280</p>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-secondary flex items-center gap-1.5">
                <lucide.Users className="w-3.5 h-3.5" /> Will reach <span className="text-primary font-bold">{recipientCount}</span> {recipientCount === 1 ? 'user' : 'users'}
              </p>
              <Button
                onClick={sendNotification}
                disabled={sendingNotif}
                loading={sendingNotif}
                loadingText="Pushing..."
                size="lg"
              >
                <lucide.Bell className="w-4 h-4" /> Push Notification
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase font-black tracking-widest text-secondary block ml-1 mb-2">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-primary border border-theme rounded-xl px-4 py-3 text-sm focus:border-accent outline-none text-primary font-bold"
                placeholder="Important update regarding your workspace..."
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-black tracking-widest text-secondary block ml-1 mb-2">HTML Body</label>
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                className="w-full bg-primary border border-theme rounded-xl p-4 h-56 font-mono text-xs text-primary focus:border-accent outline-none resize-none"
                placeholder="<h2>Hello,</h2><p>We have an update for you...</p>"
              />
            </div>
             <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-secondary flex items-center gap-1.5">
                <lucide.Users className="w-3.5 h-3.5" /> Sending to <span className="text-primary font-bold">{recipientCount}</span> {recipientCount === 1 ? 'user' : 'users'}
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setPreviewSubject(subject || 'No Subject Line');
                    setPreviewHtml(html || '<p style="color:#666">Please enter some HTML content in the editor to preview it here.</p>');
                    setPreviewOpen(true);
                  }}
                >
                  <lucide.Eye className="w-4 h-4" /> Preview Sample
                </Button>
                <Button
                  onClick={sendEmail}
                  disabled={sendingEmail}
                  loading={sendingEmail}
                  loadingText="Sending..."
                  size="lg"
                >
                  <lucide.Send className="w-4 h-4" /> Send Mass Email
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mass-send audit log */}
      <div className="bg-secondary border border-theme rounded-3xl p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <lucide.ScrollText className="w-5 h-5 text-accent" />
          <h2 className="font-black text-primary">Recent Mass Sends</h2>
        </div>
        {massLogs.length === 0 ? (
          <p className="text-xs text-secondary">No mass emails sent yet.</p>
        ) : (
          <div className="space-y-2">
            {massLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between gap-4 bg-primary border border-theme rounded-xl px-4 py-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-primary truncate">{log.subject}</p>
                  <p className="text-secondary mt-0.5">{new Date(log.sent_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSubject(log.subject);
                      setPreviewHtml(`
                        <h2 style="color: #1DB954; font-weight: 800; font-size: 18px; margin-bottom: 12px;">${log.subject}</h2>
                        <p style="margin-bottom: 16px;">This is a sample layout preview for the mass email broadcast sent to your registered audience.</p>
                        <div style="background: #050505; border: 1px dashed #1DB954; border-radius: 12px; padding: 16px; margin: 16px 0; color: #aaa; font-style: italic; text-align: center;">
                          (The specific customized dynamic content sent to individual clients is not fully stored in the audit logs, but is rendered in this template view).
                        </div>
                      `);
                      setPreviewOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/25 rounded-lg font-bold text-[10px] transition cursor-pointer"
                  >
                    <lucide.Eye className="w-3 h-3 inline mr-1" /> Preview Layout
                  </button>
                  <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-accent/10 text-accent border border-accent/20">
                    {log.recipient_count} {log.recipient_count === 1 ? 'recipient' : 'recipients'}{log.all_users ? ' · all' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prune / manage notifications */}
      <div className="bg-secondary border border-theme rounded-3xl p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <lucide.Trash2 className="w-5 h-5 text-danger" />
          <h2 className="font-black text-primary">Prune Notifications</h2>
        </div>
        <p className="text-xs text-secondary max-w-2xl">
          Clear out old in-app notifications. This removes them from every user&apos;s bell. Email delivery is unaffected.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => prune({ olderThanDays: 30 }, 'Delete notifications older than 30 days')}
            disabled={pruning}
          >
            <lucide.Clock className="w-4 h-4" /> Older than 30 days
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => prune({ olderThanDays: 7 }, 'Delete notifications older than 7 days')}
            disabled={pruning}
          >
            <lucide.Clock className="w-4 h-4" /> Older than 7 days
          </Button>
          <button
            onClick={() => prune({ all: true }, 'Delete ALL notifications')}
            disabled={pruning}
            className="px-5 py-2.5 rounded-xl border border-danger/30 bg-[var(--danger-bg)] text-danger hover:bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] text-xs font-black uppercase tracking-wider transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <lucide.Trash2 className="w-4 h-4" /> Clear everything
          </button>
        </div>
     </div>

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
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
        active ? 'bg-accent text-[var(--accent-foreground)]' : 'text-secondary hover:text-primary hover:bg-hover'
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
  return (
    <div>
      <label className="text-[10px] uppercase font-black tracking-widest text-secondary block ml-1 mb-3">Recipients</label>
      <div className="flex flex-wrap gap-3">
        <AudienceRadio active={audience === 'all'} onClick={() => setAudience('all')}>
          All registered clients ({users.length})
        </AudienceRadio>
        <AudienceRadio active={audience === 'selected'} onClick={() => setAudience('selected')}>
          Select custom recipients
        </AudienceRadio>
      </div>

      {audience === 'selected' && (
        <div className="mt-4 border border-theme rounded-2xl p-2 max-h-56 overflow-y-auto bg-primary">
          {users.length === 0 ? (
            <p className="text-xs text-secondary p-4 text-center">No users found.</p>
          ) : (
            users.map((user) => {
              const checked = selectedIds.includes(user.id);
              return (
                <label
                  key={user.id}
                  className="flex items-center gap-3 py-2 px-2 text-xs text-primary cursor-pointer hover:bg-hover rounded-lg transition"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked
                          ? [...selectedIds, user.id]
                          : selectedIds.filter((id) => id !== user.id)
                      )
                    }
                    className="accent-accent w-4 h-4"
                  />
                  <span className="font-bold">{user.full_name || 'No Name'}</span>
                  <span className="text-secondary font-mono text-[10px] truncate">{user.email}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function AudienceRadio({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition cursor-pointer border ${
        active
          ? 'border-accent bg-accent/10 text-primary'
          : 'border-theme bg-primary text-secondary hover:border-accent/50'
      }`}
    >
      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${active ? 'border-accent' : 'border-current'}`}>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
      </span>
      {children}
    </button>
  );
}

function Spinner() {
  return <div className="w-3.5 h-3.5 border-2 border-[var(--accent-foreground)]/30 border-t-[var(--accent-foreground)] rounded-full animate-spin" />;
}
