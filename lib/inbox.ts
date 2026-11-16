import { randomBytes } from 'crypto';
import { isMissingRelationError, supabaseAdmin } from '@/lib/forumServer';
import { sendSystemEmail } from '@/lib/emailService';
import { emailShell } from '@/lib/emailTemplates';
import { notifyAdmins } from '@/lib/notify';
import { siteUrl } from '@/lib/siteUrl';
import { BRANDS, brandOfAddress, type InboxBrand } from '@/lib/inboxBrands';

/**
 * The shared support inbox for developa.me and YourResearchWriter.
 * Every mailbox has a brand; every thread inherits it, so each message is clearly "for Developa" or "for
 * YourResearchWriter". Incoming mail arrives from the Cloudflare email worker (see app/api/email/inbound).
 * Server only. Tables come from migration 20261115050000_shared_support_inbox.sql.
 */

export interface Mailbox { id: string; address: string; display_name: string; brand: InboxBrand; status: 'active' | 'paused' }
export interface Thread {
  id: string; ref_code: string; mailbox_id: string; brand: InboxBrand; subject: string; customer_email: string; customer_name: string | null;
  status: 'open' | 'pending' | 'resolved' | 'spam'; priority: 'low' | 'normal' | 'high' | 'urgent'; assigned_to: string | null;
  starred: boolean; unread: boolean; first_response_at: string | null; last_message_at: string; created_at: string;
}
export interface Message {
  id: string; thread_id: string; mailbox_id: string; direction: 'inbound' | 'outbound'; from_address: string; from_name: string | null;
  to_addresses: string[]; cc_addresses: string[]; subject: string; body_text: string | null; body_html: string | null;
  message_id_header: string | null; provider_id: string | null; sent_by: string | null; created_at: string;
}

export class InboxNeedsUpdate extends Error {
  constructor() { super('The shared inbox needs the latest database update first (run the shared_support_inbox migration).'); }
}
// Rows are read from untyped tables, so results are used as plain objects; the missing-table case becomes a friendly error.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const guard = (res: { data: unknown; error: { message?: string; code?: string } | null }): any => {
  if (res.error) {
    if (isMissingRelationError(res.error)) throw new InboxNeedsUpdate();
    throw new Error(res.error.message || 'Database error');
  }
  return res.data;
};

/* ----------------------------------------------------------------------------- text helpers */

export function decodeMimeWords(str: string): string {
  if (!str) return '';
  return str.replace(/=\?([a-zA-Z0-9_-]+)\?([bBqQ])\?([^?]+)\?=/g, (m, _cs, enc, text) => {
    try {
      if (String(enc).toUpperCase() === 'B') return Buffer.from(text, 'base64').toString('utf-8');
      return text.replace(/_/g, ' ').replace(/=([A-Fa-f0-9]{2})/g, (_m: string, h: string) => String.fromCharCode(parseInt(h, 16)));
    } catch { return m; }
  });
}

export function decodeQuotedPrintable(str: string): string {
  const bytes: number[] = [];
  const clean = str.replace(/=\r?\n/g, '');
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '=' && /^[A-Fa-f0-9]{2}$/.test(clean.slice(i + 1, i + 3))) { bytes.push(parseInt(clean.slice(i + 1, i + 3), 16)); i += 2; }
    else for (const b of Array.from(Buffer.from(ch, 'utf-8'))) bytes.push(b);
  }
  return Buffer.from(bytes).toString('utf-8');
}

export function htmlToText(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/?(p|div|tr|h[1-6]|li|table)[^>]*>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text a person typed, turned into safe HTML (line breaks, bold and links). */
export function textToHtml(text: string): string {
  const html = esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g, '$1<a href="$2" style="color:#0d9488;text-decoration:underline">$2</a>')
    .replace(/\n/g, '<br/>');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1e293b">${html}</div>`;
}

const cleanSubject = (s: string) => s.replace(/\[T-[A-Z0-9]{6}\]/gi, '').replace(/^(?:\s*(?:re|fwd?|fw)\s*:\s*)+/i, '').trim();
const newRef = () => 'T-' + randomBytes(3).toString('hex').toUpperCase();

/* ----------------------------------------------------------------------------- mailboxes */

export async function getMailboxes(): Promise<Mailbox[]> {
  const data = guard(await supabaseAdmin.from('inbox_mailboxes').select('*').order('brand').order('address'));
  return (data || []) as Mailbox[];
}

export async function addMailbox(address: string, displayName: string, brand: InboxBrand): Promise<Mailbox> {
  const a = address.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) throw new Error('Enter a full email address.');
  const data = guard(await supabaseAdmin.from('inbox_mailboxes').upsert({ address: a, display_name: displayName.trim() || BRANDS[brand].label, brand, updated_at: new Date().toISOString() }, { onConflict: 'address' }).select('*').single());
  return data as Mailbox;
}

export async function updateMailbox(id: string, patch: { display_name?: string; brand?: InboxBrand; status?: 'active' | 'paused' }) {
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.display_name !== undefined) upd.display_name = patch.display_name.trim();
  if (patch.brand) upd.brand = patch.brand;
  if (patch.status) upd.status = patch.status;
  guard(await supabaseAdmin.from('inbox_mailboxes').update(upd).eq('id', id).select('id').maybeSingle());
  // Keep the brand on existing threads in step with their mailbox.
  if (patch.brand) await supabaseAdmin.from('inbox_threads').update({ brand: patch.brand }).eq('mailbox_id', id);
}

/** Finds the mailbox a message was sent to. An unknown address is added automatically, with the brand taken from its domain. */
async function mailboxFor(toAddress: string): Promise<Mailbox> {
  const addr = toAddress.trim().toLowerCase();
  const found = guard(await supabaseAdmin.from('inbox_mailboxes').select('*').eq('address', addr).maybeSingle());
  if (found) return found as Mailbox;
  const brand = brandOfAddress(addr);
  if (addr.includes('@')) return addMailbox(addr, BRANDS[brand].label, brand);
  const first = guard(await supabaseAdmin.from('inbox_mailboxes').select('*').eq('brand', 'yourwriter').limit(1).maybeSingle());
  if (first) return first as Mailbox;
  return addMailbox('inbox@yourresearchwriter.com.ng', 'YourResearchWriter', 'yourwriter');
}

/* ----------------------------------------------------------------------------- receiving */

export interface InboundPayload {
  to?: string; from?: string; fromName?: string; from_name?: string; subject?: string; text?: string; body_text?: string;
  html?: string; body_html?: string; rawBody?: string; messageId?: string; message_id?: string; inReplyTo?: string; in_reply_to?: string;
}

export async function ingestInbound(body: InboundPayload): Promise<{ success: boolean; thread_id: string; message_id: string; brand: InboxBrand; duplicate?: boolean }> {
  const to = (body.to || '').trim().toLowerCase();
  let from = (body.from || '').trim().toLowerCase();
  let subject = decodeMimeWords((body.subject || '(No subject)').trim());
  let name = body.fromName || body.from_name || '';
  let text = body.text || body.body_text || '';
  let html: string | null = body.html || body.body_html || null;

  if (body.rawBody) {
    const raw = body.rawBody;
    const sub = raw.match(/^Subject:\s*([^\r\n]+)/im);
    if (sub && (!subject || subject === '(No subject)' || subject.includes('=?'))) subject = decodeMimeWords(sub[1].trim());
    // The address a person would reply to. The envelope sender is often a machine address (a bounce or return-path
    // address used by email services), so the visible Reply-To or From header wins, and the envelope is the last resort.
    const addrOf = (header: string) => {
      const m = raw.match(new RegExp('^' + header + ':\\s*(?:["\']?([^"\'<\\r\\n]+)["\']?\\s*)?<([^>\\r\\n]+)>', 'im')) || raw.match(new RegExp('^' + header + ':\\s*([^\\s<>,;]+@[^\\s<>,;]+)', 'im'));
      if (!m) return null;
      return m.length > 2 ? { name: m[1] ? decodeMimeWords(m[1].trim()) : '', email: m[2].trim().toLowerCase() } : { name: '', email: m[1].trim().toLowerCase() };
    };
    const fromHeader = addrOf('From');
    const replyTo = addrOf('Reply-To');
    const visible = replyTo || fromHeader;
    if (visible?.email) from = visible.email;
    if (!name && (fromHeader?.name || visible?.name)) name = fromHeader?.name || visible?.name || '';
    if (/^(Received:|ARC-|MIME-Version:|Return-Path:|DKIM-|Content-Type:)/im.test(raw)) {
      const decodePart = (head: string, content: string) => (/quoted-printable/i.test(head) ? decodeQuotedPrintable(content) : /base64/i.test(head) ? Buffer.from(content.replace(/\s+/g, ''), 'base64').toString('utf-8') : content);
      const h = raw.match(/Content-Type:\s*text\/html([^]*?)\r?\n\r?\n([\s\S]*?)(?:\r?\n--[A-Za-z0-9'()+_,./:=?-]+|$)/i);
      if (h) html = decodePart(h[1], h[2]).trim();
      const p = raw.match(/Content-Type:\s*text\/plain([^]*?)\r?\n\r?\n([\s\S]*?)(?:\r?\n--[A-Za-z0-9'()+_,./:=?-]+|$)/i);
      if (p) text = decodePart(p[1], p[2]).trim();
    } else if (!text) text = raw;
  }
  if (!text && html) text = htmlToText(html);
  else if (text && /<[a-z!][\s\S]*>/i.test(text)) { if (!html) html = text; text = htmlToText(text); }
  if (!from) throw new Error("Missing sender address ('from').");
  if (!name) name = from.split('@')[0];

  const messageId = body.messageId || body.message_id || null;
  const inReplyTo = body.inReplyTo || body.in_reply_to || null;
  const mailbox = await mailboxFor(to);

  // The same email must never be stored twice (the worker can retry).
  if (messageId) {
    const dup = guard(await supabaseAdmin.from('inbox_messages').select('id, thread_id').eq('message_id_header', messageId).maybeSingle());
    if (dup) return { success: true, thread_id: dup.thread_id as string, message_id: dup.id as string, brand: mailbox.brand, duplicate: true };
  }
  const recent = guard(await supabaseAdmin.from('inbox_messages').select('id, thread_id').eq('direction', 'inbound').eq('from_address', from).eq('subject', subject).gte('created_at', new Date(Date.now() - 60_000).toISOString()).limit(1).maybeSingle());
  if (recent) return { success: true, thread_id: recent.thread_id as string, message_id: recent.id as string, brand: mailbox.brand, duplicate: true };

  // Which conversation does this belong to? 1) the reference code in the subject, 2) the message it replies to, 3) same sender and subject recently.
  let threadId: string | null = null;
  const ref = `${subject} ${html || ''} ${text}`.match(/\bT-[A-F0-9]{6}\b/i)?.[0]?.toUpperCase();
  if (ref) threadId = (guard(await supabaseAdmin.from('inbox_threads').select('id').eq('ref_code', ref).maybeSingle())?.id as string) || null;
  if (!threadId && inReplyTo) threadId = (guard(await supabaseAdmin.from('inbox_messages').select('thread_id').eq('message_id_header', inReplyTo).maybeSingle())?.thread_id as string) || null;
  if (!threadId) {
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const cands = guard(await supabaseAdmin.from('inbox_threads').select('id, subject').eq('customer_email', from).eq('mailbox_id', mailbox.id).neq('status', 'spam').gte('last_message_at', since).order('last_message_at', { ascending: false }).limit(10)) || [];
    const wanted = cleanSubject(subject).toLowerCase();
    threadId = ((cands as { id: string; subject: string }[]).find((t) => cleanSubject(t.subject).toLowerCase() === wanted)?.id) || null;
  }

  const now = new Date().toISOString();
  if (threadId) {
    // A new message reopens a finished conversation and marks it unread.
    await supabaseAdmin.from('inbox_threads').update({ unread: true, last_message_at: now, updated_at: now, status: 'open' }).eq('id', threadId).neq('status', 'spam');
  } else {
    const created = guard(await supabaseAdmin.from('inbox_threads').insert({ ref_code: newRef(), mailbox_id: mailbox.id, brand: mailbox.brand, subject: cleanSubject(subject) || '(No subject)', customer_email: from, customer_name: name, last_message_at: now }).select('id').single());
    threadId = created!.id as string;
  }

  const msg = guard(await supabaseAdmin.from('inbox_messages').insert({
    thread_id: threadId, mailbox_id: mailbox.id, direction: 'inbound', from_address: from, from_name: name, to_addresses: to ? [to] : [],
    subject, body_text: text.slice(0, 60000), body_html: html ? html.slice(0, 200000) : null, message_id_header: messageId, in_reply_to_header: inReplyTo,
  }).select('id').single());

  const label = BRANDS[mailbox.brand].label;
  await notifyAdmins({
    title: `[${label}] New email from ${name}`,
    message: `${subject}\n${text.slice(0, 160)}`,
    type: 'admin_message',
    link: '/admin/inbox',
  }).catch(() => undefined);

  return { success: true, thread_id: threadId, message_id: msg!.id as string, brand: mailbox.brand };
}

/* ----------------------------------------------------------------------------- reading */

export async function listThreads(f: { brand?: string; status?: string; mailboxId?: string; assignedTo?: string; q?: string; unread?: boolean; limit?: number }) {
  let q = supabaseAdmin.from('inbox_threads').select('*').order('last_message_at', { ascending: false }).limit(Math.min(f.limit || 100, 300));
  if (f.brand && f.brand !== 'all') q = q.eq('brand', f.brand);
  if (f.status && f.status !== 'all') q = q.eq('status', f.status); else q = q.neq('status', 'spam');
  if (f.mailboxId && f.mailboxId !== 'all') q = q.eq('mailbox_id', f.mailboxId);
  if (f.assignedTo) q = q.eq('assigned_to', f.assignedTo);
  if (f.unread) q = q.eq('unread', true);
  if (f.q) {
    const safe = f.q.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);
    if (safe) q = q.or(`subject.ilike.%${safe}%,customer_email.ilike.%${safe}%,customer_name.ilike.%${safe}%,ref_code.ilike.%${safe}%`);
  }
  const threads = (guard(await q) || []) as Thread[];
  // The latest message of each thread, for the preview line.
  const ids = threads.map((t) => t.id);
  const preview = new Map<string, { text: string; direction: string }>();
  if (ids.length) {
    const msgs = (guard(await supabaseAdmin.from('inbox_messages').select('thread_id, body_text, direction, created_at').in('thread_id', ids).order('created_at', { ascending: false }).limit(ids.length * 3)) || []) as { thread_id: string; body_text: string | null; direction: string }[];
    for (const m of msgs) if (!preview.has(m.thread_id)) preview.set(m.thread_id, { text: (m.body_text || '').replace(/\s+/g, ' ').slice(0, 140), direction: m.direction });
  }
  return threads.map((t) => ({ ...t, preview: preview.get(t.id)?.text || '', last_direction: preview.get(t.id)?.direction || 'inbound' }));
}

/** How many conversations need attention, per brand. */
export async function counts() {
  const rows = (guard(await supabaseAdmin.from('inbox_threads').select('brand, status, unread').in('status', ['open', 'pending'])) || []) as { brand: InboxBrand; status: string; unread: boolean }[];
  const out = { total: 0, unread: 0, developa: { open: 0, unread: 0 }, yourwriter: { open: 0, unread: 0 } };
  for (const r of rows) {
    out.total++; out.unread += r.unread ? 1 : 0;
    out[r.brand].open++; out[r.brand].unread += r.unread ? 1 : 0;
  }
  return out;
}

export async function getThread(id: string) {
  const thread = guard(await supabaseAdmin.from('inbox_threads').select('*').eq('id', id).maybeSingle()) as Thread | null;
  if (!thread) return null;
  const [messages, notes, mailbox] = await Promise.all([
    supabaseAdmin.from('inbox_messages').select('*').eq('thread_id', id).order('created_at', { ascending: true }),
    supabaseAdmin.from('inbox_notes').select('*').eq('thread_id', id).order('created_at', { ascending: true }),
    supabaseAdmin.from('inbox_mailboxes').select('*').eq('id', thread.mailbox_id).maybeSingle(),
  ]);
  // Opening a conversation marks it read.
  if (thread.unread) await supabaseAdmin.from('inbox_threads').update({ unread: false }).eq('id', id);
  return { thread: { ...thread, unread: false }, messages: (messages.data || []) as Message[], notes: notes.data || [], mailbox: (mailbox.data || null) as Mailbox | null };
}

export async function updateThread(id: string, patch: { status?: string; priority?: string; assigned_to?: string | null; starred?: boolean; unread?: boolean }) {
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status && ['open', 'pending', 'resolved', 'spam'].includes(patch.status)) upd.status = patch.status;
  if (patch.priority && ['low', 'normal', 'high', 'urgent'].includes(patch.priority)) upd.priority = patch.priority;
  if (patch.assigned_to !== undefined) upd.assigned_to = patch.assigned_to || null;
  if (typeof patch.starred === 'boolean') upd.starred = patch.starred;
  if (typeof patch.unread === 'boolean') upd.unread = patch.unread;
  return guard(await supabaseAdmin.from('inbox_threads').update(upd).eq('id', id).select('*').maybeSingle()) as Thread | null;
}

export async function batchUpdate(ids: string[], action: string, value?: string) {
  if (action === 'delete') { guard(await supabaseAdmin.from('inbox_threads').delete().in('id', ids).select('id')); return { count: ids.length }; }
  const patch: Record<string, unknown> = {};
  if (action === 'status') patch.status = value;
  else if (action === 'priority') patch.priority = value;
  else if (action === 'assign') patch.assigned_to = value || null;
  else if (action === 'read') patch.unread = false;
  else if (action === 'unread') patch.unread = true;
  else throw new Error('Unknown action.');
  for (const id of ids) await updateThread(id, patch as Parameters<typeof updateThread>[1]);
  return { count: ids.length };
}

export async function deleteThread(id: string) { guard(await supabaseAdmin.from('inbox_threads').delete().eq('id', id).select('id')); return true; }

export async function addNote(threadId: string, authorEmail: string, authorName: string, content: string) {
  return guard(await supabaseAdmin.from('inbox_notes').insert({ thread_id: threadId, author_email: authorEmail, author_name: authorName, content: content.slice(0, 4000) }).select('*').single());
}

export async function getMacros(brand?: string) {
  let q = supabaseAdmin.from('inbox_macros').select('*').order('category').order('title');
  if (brand === 'developa' || brand === 'yourwriter') q = q.or(`brand.is.null,brand.eq.${brand}`);
  return guard(await q) || [];
}
export async function saveMacro(m: { id?: string; title: string; subject?: string; body: string; brand?: string | null; category?: string }, by: string) {
  const row = { title: m.title.trim().slice(0, 120), subject: m.subject?.trim() || null, body: m.body.slice(0, 8000), brand: m.brand === 'developa' || m.brand === 'yourwriter' ? m.brand : null, category: (m.category || 'General').slice(0, 40), created_by: by };
  if (m.id) return guard(await supabaseAdmin.from('inbox_macros').update(row).eq('id', m.id).select('*').single());
  return guard(await supabaseAdmin.from('inbox_macros').insert(row).select('*').single());
}
export async function deleteMacro(id: string) { guard(await supabaseAdmin.from('inbox_macros').delete().eq('id', id).select('id')); }

/* ----------------------------------------------------------------------------- sending */

export async function sendReply(p: {
  mailbox_id: string; thread_id?: string | null; to: string; subject: string; body: string; cc?: string[];
  customer_name?: string; priority?: Thread['priority']; sent_by: string; set_status?: Thread['status'];
}): Promise<{ thread_id: string; message_id: string; provider_id: string | null }> {
  const to = p.to.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('Enter a valid recipient address.');
  if (!p.subject.trim() || !p.body.trim()) throw new Error('A subject and a message are required.');
  const mailbox = guard(await supabaseAdmin.from('inbox_mailboxes').select('*').eq('id', p.mailbox_id).maybeSingle()) as Mailbox | null;
  if (!mailbox) throw new Error('Mailbox not found.');
  if (mailbox.status === 'paused') throw new Error('This mailbox is paused, so it cannot send.');
  const brand = BRANDS[mailbox.brand];

  // The same message sent twice within 15 seconds is sent once.
  const recent = guard(await supabaseAdmin.from('inbox_messages').select('id, thread_id, provider_id').eq('direction', 'outbound').eq('mailbox_id', mailbox.id).contains('to_addresses', [to]).eq('subject', p.subject).gte('created_at', new Date(Date.now() - 15_000).toISOString()).limit(1).maybeSingle());
  if (recent) return { thread_id: recent.thread_id as string, message_id: recent.id as string, provider_id: (recent.provider_id as string) || null };

  const now = new Date().toISOString();
  let thread: Thread | null = null;
  if (p.thread_id) thread = guard(await supabaseAdmin.from('inbox_threads').select('*').eq('id', p.thread_id).maybeSingle()) as Thread | null;
  if (!thread) {
    thread = guard(await supabaseAdmin.from('inbox_threads').insert({ ref_code: newRef(), mailbox_id: mailbox.id, brand: mailbox.brand, subject: cleanSubject(p.subject) || p.subject, customer_email: to, customer_name: p.customer_name || null, priority: p.priority || 'normal', status: 'pending', unread: false, last_message_at: now }).select('*').single()) as Thread;
  }

  // The reference code in the subject lets the customer's reply find this conversation again.
  const subject = /\[T-[A-F0-9]{6}\]/i.test(p.subject) ? p.subject : `${p.subject.trim()} [${thread.ref_code}]`;
  const html = emailShell(textToHtml(p.body) + `<!-- inbox_thread:${thread.id} -->`, `Visit ${brand.label}`, brand.url || siteUrl(), brand.shell);
  const result = await sendSystemEmail({
    to, subject, html, text: p.body,
    from: `${mailbox.display_name} <${mailbox.address}>`, fromName: mailbox.display_name, replyTo: mailbox.address,
  }) as { providerId?: string | null; id?: string | null } | undefined;
  const providerId = (result && (result.providerId || result.id)) || null;

  const msg = guard(await supabaseAdmin.from('inbox_messages').insert({
    thread_id: thread.id, mailbox_id: mailbox.id, direction: 'outbound', from_address: mailbox.address, from_name: mailbox.display_name,
    to_addresses: [to], cc_addresses: p.cc || [], subject, body_text: p.body, body_html: html, provider_id: providerId, sent_by: p.sent_by,
  }).select('id').single());

  await supabaseAdmin.from('inbox_threads').update({
    last_message_at: now, updated_at: now, unread: false, status: p.set_status || (thread.status === 'spam' ? 'spam' : 'pending'),
    first_response_at: thread.first_response_at || now,
  }).eq('id', thread.id);

  return { thread_id: thread.id, message_id: msg!.id as string, provider_id: providerId };
}
