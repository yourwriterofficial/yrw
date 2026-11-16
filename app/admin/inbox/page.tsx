'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Star, Search, Inbox as InboxIcon, Send, StickyNote, Trash2, Plus, Settings2, ArrowLeft, Mail, CornerUpLeft } from 'lucide-react';
import { BRANDS, type InboxBrand } from '@/lib/inboxBrands';

interface Thread { id: string; ref_code: string; mailbox_id: string; brand: InboxBrand; subject: string; customer_email: string; customer_name: string | null; status: 'open' | 'pending' | 'resolved' | 'spam'; priority: 'low' | 'normal' | 'high' | 'urgent'; assigned_to: string | null; starred: boolean; unread: boolean; last_message_at: string; preview: string; last_direction: string }
interface Message { id: string; direction: 'inbound' | 'outbound'; from_address: string; from_name: string | null; to_addresses: string[]; subject: string; body_text: string | null; created_at: string; sent_by: string | null }
interface Note { id: string; author_name: string | null; author_email: string; content: string; created_at: string }
interface Mailbox { id: string; address: string; display_name: string; brand: InboxBrand; status: 'active' | 'paused' }
interface Macro { id: string; title: string; subject: string | null; body: string; brand: InboxBrand | null; category: string }
interface Counts { total: number; unread: number; developa: { open: number; unread: number }; yourwriter: { open: number; unread: number } }

async function api<T = Record<string, unknown>>(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; needs_update?: boolean };
  return { ok: res.ok, data };
}

const ago = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });
const STATUS_LABEL: Record<string, string> = { open: 'Open', pending: 'Waiting for customer', resolved: 'Resolved', spam: 'Spam' };
const PRIORITY_DOT: Record<string, string> = { urgent: 'bg-danger', high: 'bg-warning', normal: 'bg-transparent', low: 'bg-secondary' };

function BrandBadge({ brand }: { brand: InboxBrand }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${BRANDS[brand].badge}`}>{BRANDS[brand].short}</span>;
}

export default function AdminInboxPage() {
  // Open on the tab of the admin you are in: Developa on developa.me, YourResearchWriter on the main site.
  const [brand, setBrand] = useState<'all' | InboxBrand>('all');
  useEffect(() => { if (typeof window !== 'undefined') setBrand(window.location.hostname.includes('developa') ? 'developa' : 'yourwriter'); }, []);
  const [status, setStatus] = useState<'open' | 'pending' | 'resolved' | 'spam' | 'all'>('open');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [panel, setPanel] = useState<'none' | 'compose' | 'mailboxes' | 'macros'>('none');
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [me, setMe] = useState('');

  const flash = (ok: boolean, text: string) => { setNote({ ok, text }); setTimeout(() => setNote(null), 4500); };

  const load = useCallback(async () => {
    const p = new URLSearchParams({ brand, status, ...(unreadOnly ? { unread: '1' } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
    const r = await api<{ threads?: Thread[]; counts?: Counts; me?: string }>(`/api/admin/inbox/threads?${p}`);
    setNeedsUpdate(!!r.data.needs_update);
    if (r.ok) { setThreads(r.data.threads || []); setCounts(r.data.counts || null); setMe(r.data.me || ''); }
    setLoading(false);
  }, [brand, status, unreadOnly, q]);

  useEffect(() => { const t = setTimeout(() => { void load(); }, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  // New mail shows up without a refresh.
  useEffect(() => { const t = setInterval(() => { void load(); }, 30_000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    (async () => {
      const [m, c] = await Promise.all([api<{ mailboxes?: Mailbox[] }>('/api/admin/inbox/mailboxes'), api<{ macros?: Macro[] }>('/api/admin/inbox/macros')]);
      setMailboxes(m.data.mailboxes || []);
      setMacros(c.data.macros || []);
    })();
  }, []);

  const batch = async (action: string, value?: string) => {
    if (!checked.length) return;
    if (action === 'delete' && !confirm(`Delete ${checked.length} conversation(s) for good?`)) return;
    const r = await api('/api/admin/inbox/threads/batch', 'POST', { ids: checked, action, value });
    flash(r.ok, r.ok ? 'Done.' : (r.data.error as string) || 'Could not do that.');
    setChecked([]);
    if (action === 'delete' && selected && checked.includes(selected)) setSelected(null);
    await load();
  };

  const brandTabs: { key: 'all' | InboxBrand; label: string; unread?: number }[] = [
    { key: 'all', label: 'All', unread: counts?.unread },
    { key: 'developa', label: 'Developa', unread: counts?.developa.unread },
    { key: 'yourwriter', label: 'YourResearchWriter', unread: counts?.yourwriter.unread },
  ];

  return (
    <div className="p-4 md:p-6 max-w-[1500px] mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2"><InboxIcon className="w-6 h-6 text-accent" /> Support inbox</h1>
          <p className="text-sm text-secondary mt-0.5">Customer email for Developa and YourResearchWriter in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPanel(panel === 'macros' ? 'none' : 'macros')} className={`h-10 px-4 rounded-xl border text-sm font-medium ${panel === 'macros' ? 'border-accent bg-accent/10' : 'border-theme hover:bg-hover'}`}>Saved replies</button>
          <button onClick={() => setPanel(panel === 'mailboxes' ? 'none' : 'mailboxes')} className={`h-10 px-4 rounded-xl border text-sm font-medium inline-flex items-center gap-2 ${panel === 'mailboxes' ? 'border-accent bg-accent/10' : 'border-theme hover:bg-hover'}`}><Settings2 className="w-4 h-4" /> Mailboxes</button>
          <button onClick={() => setPanel(panel === 'compose' ? 'none' : 'compose')} className="h-10 px-4 rounded-xl bg-accent text-[var(--accent-foreground)] text-sm font-bold inline-flex items-center gap-2 shadow-sm"><Plus className="w-4 h-4" /> New message</button>
        </div>
      </div>

      {needsUpdate && <p className="text-sm text-warning border border-warning/30 rounded-xl p-4">The inbox needs the latest database update first (<span className="font-mono">20261115050000_shared_support_inbox.sql</span>). Until then, incoming emails only send an alert to the admins.</p>}
      {note && <p className={`text-sm rounded-xl p-3 border ${note.ok ? 'text-success border-success/30 bg-success/5' : 'text-danger border-danger/30 bg-danger/5'}`} role="status">{note.text}</p>}

      {panel === 'compose' && <ComposePanel mailboxes={mailboxes} macros={macros} onClose={() => setPanel('none')} onSent={async (id) => { setPanel('none'); flash(true, 'Message sent.'); await load(); setSelected(id); }} flash={flash} />}
      {panel === 'mailboxes' && <MailboxesPanel mailboxes={mailboxes} reload={async () => { const m = await api<{ mailboxes?: Mailbox[] }>('/api/admin/inbox/mailboxes'); setMailboxes(m.data.mailboxes || []); await load(); }} flash={flash} />}
      {panel === 'macros' && <MacrosPanel macros={macros} reload={async () => { const c = await api<{ macros?: Macro[] }>('/api/admin/inbox/macros'); setMacros(c.data.macros || []); }} flash={flash} />}

      <div className="grid xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] gap-4 h-[calc(100vh-230px)] min-h-[520px]">
        {/* list */}
        <section className={`g-card overflow-hidden flex flex-col min-h-0 ${selected ? 'hidden xl:flex' : 'flex'}`}>
          <div className="p-3 border-b border-theme space-y-2.5 shrink-0">
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-secondary/60 border border-theme" role="group" aria-label="Which brand">
              {brandTabs.map((t) => (
                <button key={t.key} onClick={() => setBrand(t.key)} aria-pressed={brand === t.key} className={`h-8 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition ${brand === t.key ? 'bg-card shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}>
                  <span className="truncate">{t.label}</span>{!!t.unread && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[var(--accent-foreground)] text-[10px] font-bold flex items-center justify-center">{t.unread}</span>}
                </button>
              ))}
            </div>
            <div className="relative"><Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, subject or T-code" aria-label="Search the inbox" className="w-full h-10 rounded-xl border border-theme bg-card pl-9 pr-3 text-sm" /></div>
            <div className="flex flex-wrap gap-1.5">
              {(['open', 'pending', 'resolved', 'spam', 'all'] as const).map((s) => <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={`h-7 px-2.5 rounded-lg text-xs font-medium border ${status === s ? 'border-accent bg-accent/10 text-accent' : 'border-theme text-secondary hover:bg-hover'}`}>{s === 'all' ? 'Everything' : s === 'pending' ? 'Waiting' : STATUS_LABEL[s]}</button>)}
              <button onClick={() => setUnreadOnly((u) => !u)} aria-pressed={unreadOnly} className={`h-7 px-2.5 rounded-lg text-xs font-medium border ${unreadOnly ? 'border-accent bg-accent/10 text-accent' : 'border-theme text-secondary hover:bg-hover'}`}>Unread</button>
            </div>
            {checked.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs rounded-lg bg-accent/5 border border-accent/20 p-1.5">
                <span className="font-bold px-1">{checked.length} picked</span>
                <button onClick={() => batch('status', 'resolved')} className="px-2.5 h-7 rounded-lg border border-theme bg-card">Resolve</button>
                <button onClick={() => batch('status', 'spam')} className="px-2.5 h-7 rounded-lg border border-theme bg-card">Spam</button>
                <button onClick={() => batch('read')} className="px-2.5 h-7 rounded-lg border border-theme bg-card">Mark read</button>
                <button onClick={() => batch('delete')} className="px-2.5 h-7 rounded-lg border border-danger/40 text-danger bg-card">Delete</button>
              </div>
            )}
          </div>
          {loading ? <p className="p-6 text-sm text-secondary">Loading…</p> : threads.length === 0 ? (
            <div className="p-10 text-center text-secondary flex-1"><Mail className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm font-medium">Nothing here</p><p className="text-xs mt-1">New mail to your support addresses shows up in this list.</p></div>
          ) : (
            <ul className="divide-y divide-theme overflow-y-auto flex-1 min-h-0">
              {threads.map((t) => (
                <li key={t.id} className={`flex gap-3 px-3 py-3 cursor-pointer transition border-l-2 ${selected === t.id ? 'bg-accent/5 border-accent' : 'border-transparent hover:bg-hover'}`} onClick={() => { setSelected(t.id); setPanel('none'); }}>
                  <div className="relative shrink-0">
                    <Initial name={t.customer_name || t.customer_email} brand={t.brand} />
                    <input type="checkbox" aria-label={`Pick ${t.subject}`} checked={checked.includes(t.id)} onClick={(e) => e.stopPropagation()} onChange={() => setChecked((c) => (c.includes(t.id) ? c.filter((x) => x !== t.id) : [...c, t.id]))} className={`absolute -left-1 -top-1 w-4 h-4 ${checked.includes(t.id) ? '' : 'opacity-0 hover:opacity-100 focus:opacity-100'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${t.unread ? 'font-bold' : 'font-medium'}`}>{t.customer_name || t.customer_email}</p>
                      {t.starred && <Star className="w-3 h-3 fill-warning text-warning shrink-0" />}
                      <span className="ml-auto text-[11px] text-secondary shrink-0">{ago(t.last_message_at)}</span>
                    </div>
                    <p className={`text-[13px] truncate ${t.unread ? 'font-semibold' : 'text-secondary'}`}>{t.subject}</p>
                    <p className="text-xs text-secondary truncate">{t.last_direction === 'outbound' ? 'You: ' : ''}{previewText(t.preview)}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <BrandBadge brand={t.brand} />
                      {t.status !== 'open' && <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-theme text-secondary">{STATUS_LABEL[t.status]}</span>}
                      {t.priority !== 'normal' && <span className="flex items-center gap-1 text-[10px] text-secondary"><span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`} />{t.priority}</span>}
                      {t.assigned_to && <span className="text-[10px] text-secondary">→ {t.assigned_to.split('@')[0]}</span>}
                      {t.unread && <span className="ml-auto w-2 h-2 rounded-full bg-accent" aria-label="Unread" />}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* conversation */}
        <section className={`min-h-0 ${selected ? 'flex' : 'hidden xl:flex'} flex-col`}>
          {selected ? <ThreadView key={selected} id={selected} me={me} mailboxes={mailboxes} macros={macros} onBack={() => setSelected(null)} onChanged={load} onDeleted={() => { setSelected(null); void load(); }} flash={flash} /> : (
            <div className="g-card flex-1 flex flex-col items-center justify-center text-center text-secondary p-10"><Mail className="w-10 h-10 mb-3 opacity-40" /><p className="text-sm font-medium">Pick a conversation</p><p className="text-xs mt-1">Read it, reply, resolve it, or leave a private note for the team.</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Round initial for a person, tinted by the brand they wrote to. */
function Initial({ name, brand }: { name: string; brand: InboxBrand }) {
  const c = (name.trim()[0] || '?').toUpperCase();
  return <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${brand === 'developa' ? 'bg-accent/15 text-accent' : 'bg-success/15 text-success'}`}>{c}</div>;
}

/** The first lines of a message without the quoted earlier mail ("On … wrote:" and "> …"). */
function previewText(s: string) {
  return splitQuote(s).main.replace(/\s+/g, ' ').slice(0, 140);
}

/** Splits a reply into what the person wrote and the older mail they quoted under it. */
function splitQuote(text: string): { main: string; quoted: string } {
  const t = (text || '').replace(/\r/g, '');
  const m = t.match(/\n?\s*On .{4,120}wrote:\s*\n?/) || t.match(/\n-{2,}\s*Original Message\s*-{2,}/i) || t.match(/\n\s*>/);
  if (m && m.index !== undefined && m.index > 0) return { main: t.slice(0, m.index).trim(), quoted: t.slice(m.index).trim() };
  return { main: t.trim(), quoted: '' };
}

/* ------------------------------------------------------------------ one conversation */

function ThreadView({ id, me, mailboxes, macros, onBack, onChanged, onDeleted, flash }: { id: string; me: string; mailboxes: Mailbox[]; macros: Macro[]; onBack: () => void; onChanged: () => Promise<void>; onDeleted: () => void; flash: (ok: boolean, t: string) => void }) {
  const [d, setD] = useState<{ thread: Thread; messages: Message[]; notes: Note[]; mailbox: Mailbox | null } | null>(null);
  const [mailboxId, setMailboxId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [noteText, setNoteText] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ thread: Thread; messages: Message[]; notes: Note[]; mailbox: Mailbox | null }>(`/api/admin/inbox/threads/${id}`);
    if (r.ok) { setD(r.data as never); setMailboxId((r.data as { thread: Thread }).thread.mailbox_id); setSubject((s) => s || `Re: ${(r.data as { thread: Thread }).thread.subject}`); }
    await onChanged();
  }, [id, onChanged]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [d?.messages.length, d?.notes.length]);

  const brandBoxes = useMemo(() => mailboxes.filter((m) => d && m.brand === d.thread.brand && m.status === 'active'), [mailboxes, d]);
  if (!d) return <div className="g-card p-8 text-sm text-secondary">Opening…</div>;
  const t = d.thread;

  const patch = async (p: Record<string, unknown>) => { const r = await api(`/api/admin/inbox/threads/${id}`, 'PATCH', p); if (!r.ok) flash(false, (r.data.error as string) || 'Could not update.'); await load(); };
  const sendMsg = async (setStatus?: 'resolved') => {
    setBusy(true);
    const r = await api('/api/admin/inbox/send', 'POST', { mailbox_id: mailboxId || t.mailbox_id, thread_id: t.id, to: t.customer_email, subject, body, customer_name: t.customer_name || undefined, set_status: setStatus });
    setBusy(false);
    if (r.ok) { setBody(''); flash(true, 'Reply sent.'); await load(); } else flash(false, (r.data.error as string) || 'Could not send.');
  };
  const addNote = async () => { if (!noteText.trim()) return; const r = await api('/api/admin/inbox/notes', 'POST', { thread_id: t.id, content: noteText }); if (r.ok) { setNoteText(''); await load(); } else flash(false, (r.data.error as string) || 'Could not save the note.'); };
  const applyMacro = (m: Macro) => { const first = (t.customer_name || t.customer_email.split('@')[0]).split(' ')[0]; setBody((b) => (b ? b + '\n\n' : '') + m.body.replace(/\{\{\s*name\s*\}\}/g, first)); if (m.subject) setSubject(m.subject); };
  const remove = async () => { if (!confirm('Delete this conversation for good?')) return; await api(`/api/admin/inbox/threads/${t.id}`, 'DELETE'); onDeleted(); };
  const myMacros = macros.filter((m) => !m.brand || m.brand === t.brand);
  const sel = 'h-9 rounded-lg border border-theme bg-card px-2.5 text-sm font-medium';

  // Messages and private notes in the order they happened.
  const feed = [
    ...d.messages.map((m) => ({ kind: 'msg' as const, at: m.created_at, m })),
    ...d.notes.map((n) => ({ kind: 'note' as const, at: n.created_at, n })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="g-card overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="px-4 py-3 border-b border-theme space-y-3 shrink-0">
        <div className="flex items-start gap-3">
          <button onClick={onBack} aria-label="Back to the list" className="xl:hidden w-9 h-9 rounded-lg hover:bg-hover flex items-center justify-center shrink-0"><ArrowLeft className="w-5 h-5" /></button>
          <Initial name={t.customer_name || t.customer_email} brand={t.brand} />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-base leading-snug break-words">{t.subject}</h2>
            <p className="text-xs text-secondary mt-0.5 break-words">{t.customer_name ? `${t.customer_name} · ` : ''}<a href={`mailto:${t.customer_email}`} className="hover:underline">{t.customer_email}</a> · to {d.mailbox?.address || 'mailbox'}</p>
            <div className="flex items-center gap-2 mt-1.5"><BrandBadge brand={t.brand} /><span className="font-mono text-[11px] text-secondary">{t.ref_code}</span></div>
          </div>
          <button onClick={() => patch({ starred: !t.starred })} aria-label={t.starred ? 'Remove star' : 'Star'} className="w-9 h-9 rounded-lg hover:bg-hover flex items-center justify-center shrink-0"><Star className={`w-5 h-5 ${t.starred ? 'fill-warning text-warning' : 'text-secondary'}`} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={t.status} onChange={(e) => patch({ status: e.target.value })} aria-label="Status" className={sel}>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={t.priority} onChange={(e) => patch({ priority: e.target.value })} aria-label="Priority" className={sel}>{['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)} priority</option>)}</select>
          <button onClick={() => patch({ assigned_to: t.assigned_to ? null : me || null })} className="h-9 px-3 rounded-lg border border-theme hover:bg-hover text-xs font-medium">{t.assigned_to ? `Assigned to ${t.assigned_to.split('@')[0]} · unassign` : 'Assign to me'}</button>
          <button onClick={() => patch({ unread: true })} className="h-9 px-3 rounded-lg border border-theme hover:bg-hover text-xs font-medium">Mark unread</button>
          <button onClick={remove} aria-label="Delete conversation" className="h-9 w-9 rounded-lg border border-danger/40 text-danger flex items-center justify-center ml-auto"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-secondary/30">
        {feed.map((f) => {
          if (f.kind === 'note') {
            const n = f.n;
            return (
              <article key={`n-${n.id}`} className="rounded-xl p-3 border border-warning/40 bg-warning/5 text-sm">
                <p className="text-xs text-secondary mb-1 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Private note by {n.author_name || n.author_email} · {ago(n.created_at)}</p>
                <p className="whitespace-pre-wrap">{n.content}</p>
              </article>
            );
          }
          const m = f.m;
          const out = m.direction === 'outbound';
          const { main, quoted } = splitQuote(m.body_text || '');
          return (
            <article key={`m-${m.id}`} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm border ${out ? 'bg-accent/10 border-accent/25 rounded-br-md' : 'bg-card border-theme rounded-bl-md'}`}>
                <p className="text-[11px] text-secondary mb-1.5">{out ? <>You{m.sent_by ? ` (${m.sent_by.split('@')[0]})` : ''}</> : <b className="text-primary">{m.from_name || m.from_address}</b>} · {new Date(m.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                <p className="whitespace-pre-wrap break-words leading-relaxed">{main || '(No text)'}</p>
                {quoted && (
                  <>
                    <button onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))} className="mt-2 text-[11px] px-2 py-0.5 rounded-md border border-theme text-secondary hover:bg-hover" aria-expanded={!!open[m.id]}>{open[m.id] ? 'Hide earlier message' : '···  Show earlier message'}</button>
                    {open[m.id] && <p className="mt-2 pl-3 border-l-2 border-theme whitespace-pre-wrap break-words text-xs text-secondary">{quoted}</p>}
                  </>
                )}
              </div>
            </article>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-theme shrink-0 bg-card">
        <div className="flex items-center gap-1 px-4 pt-3" role="tablist">
          {(['reply', 'note'] as const).map((k) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`h-8 px-3 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ${mode === k ? 'bg-accent/10 text-accent' : 'text-secondary hover:bg-hover'}`}>{k === 'reply' ? 'Reply' : 'Private note'}</button>)}
          {mode === 'reply' && myMacros.length > 0 && (
            <div className="ml-auto flex items-center gap-1 overflow-x-auto"><span className="text-[11px] text-secondary shrink-0">Saved:</span>{myMacros.slice(0, 6).map((m) => <button key={m.id} onClick={() => applyMacro(m)} className="px-2 h-7 rounded-lg border border-theme hover:bg-hover text-[11px] shrink-0">{m.title}</button>)}</div>
          )}
        </div>
        {mode === 'reply' ? (
          <div className="p-4 pt-2 space-y-2.5">
            <div className="grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
              <select id="rp-from" aria-label="Send from" value={mailboxId} onChange={(e) => setMailboxId(e.target.value)} className={`${sel} w-full`}>{(brandBoxes.length ? brandBoxes : mailboxes.filter((m) => m.id === t.mailbox_id)).map((m) => <option key={m.id} value={m.id}>From: {m.display_name} &lt;{m.address}&gt;</option>)}</select>
              <input id="rp-sub" aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={`${sel} w-full`} />
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={`Write your reply to ${t.customer_name || t.customer_email}`} aria-label="Reply" className="w-full rounded-xl border border-theme bg-card px-3 py-2.5 text-sm" />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => sendMsg()} disabled={busy || !body.trim()} className="h-10 px-5 rounded-xl bg-accent text-[var(--accent-foreground)] text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"><Send className="w-4 h-4" /> {busy ? 'Sending…' : 'Send reply'}</button>
              <button onClick={() => sendMsg('resolved')} disabled={busy || !body.trim()} className="h-10 px-5 rounded-xl border border-theme hover:bg-hover text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"><CornerUpLeft className="w-4 h-4" /> Send and resolve</button>
            </div>
          </div>
        ) : (
          <div className="p-4 pt-2 space-y-2.5">
            <textarea id="nt" value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} aria-label="Private note" className="w-full rounded-xl border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm" placeholder="Only the team sees this. For example: check their order first." />
            <button onClick={addNote} disabled={!noteText.trim()} className="h-10 px-5 rounded-xl border border-theme hover:bg-hover text-sm font-medium disabled:opacity-50">Add note</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ new message */

function ComposePanel({ mailboxes, macros, onClose, onSent, flash }: { mailboxes: Mailbox[]; macros: Macro[]; onClose: () => void; onSent: (threadId: string) => Promise<void>; flash: (ok: boolean, t: string) => void }) {
  const active = mailboxes.filter((m) => m.status === 'active');
  const [mailboxId, setMailboxId] = useState(active[0]?.id || '');
  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const mb = active.find((m) => m.id === mailboxId);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await api<{ thread_id?: string }>('/api/admin/inbox/send', 'POST', { mailbox_id: mailboxId, to, subject, body, customer_name: name || undefined });
    setBusy(false);
    if (r.ok && r.data.thread_id) await onSent(r.data.thread_id); else flash(false, (r.data.error as string) || 'Could not send.');
  };
  return (
    <form onSubmit={send} className="g-card p-5 space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-medium">New message</h3><button type="button" onClick={onClose} className="text-sm text-secondary hover:text-primary">Close</button></div>
      {active.length === 0 && <p className="text-sm text-warning">Add a mailbox first (Mailboxes).</p>}
      <div className="grid sm:grid-cols-3 gap-3">
        <div><label className="block text-xs font-medium mb-1" htmlFor="c-from">From</label><select id="c-from" value={mailboxId} onChange={(e) => setMailboxId(e.target.value)} className="input-box w-full">{active.map((m) => <option key={m.id} value={m.id}>{BRANDS[m.brand].short}: {m.address}</option>)}</select></div>
        <div><label className="block text-xs font-medium mb-1" htmlFor="c-to">To</label><input id="c-to" type="email" required value={to} onChange={(e) => setTo(e.target.value)} className="input-box w-full" /></div>
        <div><label className="block text-xs font-medium mb-1" htmlFor="c-name">Their name <span className="text-secondary font-normal">(optional)</span></label><input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className="input-box w-full" /></div>
      </div>
      <div><label className="block text-xs font-medium mb-1" htmlFor="c-sub">Subject</label><input id="c-sub" required value={subject} onChange={(e) => setSubject(e.target.value)} className="input-box w-full" /></div>
      {mb && macros.filter((m) => !m.brand || m.brand === mb.brand).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-secondary">Saved replies:</span>{macros.filter((m) => !m.brand || m.brand === mb.brand).slice(0, 8).map((m) => <button type="button" key={m.id} onClick={() => { setBody((b) => (b ? b + '\n\n' : '') + m.body.replace(/\{\{\s*name\s*\}\}/g, (name || to.split('@')[0]).split(' ')[0])); if (m.subject) setSubject(m.subject); }} className="px-2.5 h-7 rounded-full border border-theme hover:bg-hover text-xs">{m.title}</button>)}</div>
      )}
      <textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={6} aria-label="Message" className="input-box w-full" />
      <button type="submit" disabled={busy || !mailboxId} className="h-10 px-6 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-medium disabled:opacity-50">{busy ? 'Sending…' : 'Send'}</button>
    </form>
  );
}

/* ------------------------------------------------------------------ mailboxes and saved replies */

function MailboxesPanel({ mailboxes, reload, flash }: { mailboxes: Mailbox[]; reload: () => Promise<void>; flash: (ok: boolean, t: string) => void }) {
  const [address, setAddress] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [brand, setBrand] = useState<InboxBrand>('developa');
  const add = async (e: React.FormEvent) => { e.preventDefault(); const r = await api('/api/admin/inbox/mailboxes', 'POST', { address, display_name: displayName, brand }); flash(r.ok, r.ok ? 'Mailbox added.' : (r.data.error as string) || 'Could not add it.'); if (r.ok) { setAddress(''); setDisplayName(''); await reload(); } };
  const patch = async (id: string, p: Record<string, unknown>) => { const r = await api('/api/admin/inbox/mailboxes', 'PATCH', { id, ...p }); flash(r.ok, r.ok ? 'Saved.' : (r.data.error as string) || 'Could not save.'); await reload(); };
  return (
    <div className="g-card p-5 space-y-4">
      <div><h3 className="font-medium">Mailboxes</h3><p className="text-sm text-secondary">Each address belongs to a brand. Mail sent to it appears under that brand, and replies go out from it. A new address that receives mail is added automatically, with the brand taken from its domain.</p></div>
      <ul className="divide-y divide-theme text-sm">
        {mailboxes.length === 0 && <li className="py-3 text-secondary">No mailboxes yet.</li>}
        {mailboxes.map((m) => (
          <li key={m.id} className="py-2.5 flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1"><b>{m.display_name}</b> <span className="text-secondary font-mono text-xs">{m.address}</span></span>
            <select value={m.brand} onChange={(e) => patch(m.id, { brand: e.target.value })} aria-label={`Brand for ${m.address}`} className="input-box h-9 py-0"><option value="developa">Developa</option><option value="yourwriter">YourResearchWriter</option></select>
            <button onClick={() => patch(m.id, { status: m.status === 'active' ? 'paused' : 'active' })} className="h-9 px-3 rounded-full border border-theme hover:bg-hover text-xs">{m.status === 'active' ? 'Pause' : 'Resume'}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid sm:grid-cols-4 gap-3 items-end">
        <div className="sm:col-span-2"><label className="block text-xs font-medium mb-1" htmlFor="mb-a">New address</label><input id="mb-a" type="email" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="hello@developa.me" className="input-box w-full" /></div>
        <div><label className="block text-xs font-medium mb-1" htmlFor="mb-n">Name shown</label><input id="mb-n" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Developa Support" className="input-box w-full" /></div>
        <div className="flex gap-2"><select value={brand} onChange={(e) => setBrand(e.target.value as InboxBrand)} aria-label="Brand" className="input-box flex-1"><option value="developa">Developa</option><option value="yourwriter">YourResearchWriter</option></select><button type="submit" className="h-10 px-4 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-medium">Add</button></div>
      </form>
    </div>
  );
}

function MacrosPanel({ macros, reload, flash }: { macros: Macro[]; reload: () => Promise<void>; flash: (ok: boolean, t: string) => void }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [brand, setBrand] = useState<'' | InboxBrand>('');
  const save = async (e: React.FormEvent) => { e.preventDefault(); const r = await api('/api/admin/inbox/macros', 'POST', { title, subject, body, brand: brand || null }); flash(r.ok, r.ok ? 'Saved reply added.' : (r.data.error as string) || 'Could not save.'); if (r.ok) { setTitle(''); setSubject(''); setBody(''); await reload(); } };
  const del = async (m: Macro) => { if (!confirm(`Delete "${m.title}"?`)) return; await api(`/api/admin/inbox/macros?id=${m.id}`, 'DELETE'); await reload(); };
  return (
    <div className="g-card p-5 space-y-4">
      <div><h3 className="font-medium">Saved replies</h3><p className="text-sm text-secondary">Ready-made answers. Use <span className="font-mono">{'{{name}}'}</span> where the customer&apos;s first name should go.</p></div>
      <ul className="divide-y divide-theme text-sm max-h-56 overflow-y-auto">{macros.map((m) => <li key={m.id} className="py-2 flex items-center gap-3"><span className="min-w-0 flex-1 truncate"><b>{m.title}</b> <span className="text-secondary">· {m.brand ? BRANDS[m.brand].short : 'Both brands'} · {m.category}</span></span><button onClick={() => del(m)} className="text-xs text-danger hover:underline">Delete</button></li>)}</ul>
      <form onSubmit={save} className="grid gap-3">
        <div className="grid sm:grid-cols-3 gap-3"><input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" className="input-box" /><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" aria-label="Subject" className="input-box" /><select value={brand} onChange={(e) => setBrand(e.target.value as '' | InboxBrand)} aria-label="For which brand" className="input-box"><option value="">Both brands</option><option value="developa">Developa only</option><option value="yourwriter">YourResearchWriter only</option></select></div>
        <textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hello {{name}}, …" aria-label="Reply text" className="input-box w-full" />
        <button type="submit" className="h-10 px-5 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-medium w-fit">Save reply</button>
      </form>
    </div>
  );
}
