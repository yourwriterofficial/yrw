import { z } from 'zod';
import { isMissingRelationError, supabaseAdmin } from '@/lib/forumServer';
import { effectiveTier } from '@/lib/plans';
import { notifyUser } from '@/lib/notify';
import { emailShell } from '@/lib/emailTemplates';
import { siteUrl } from '@/lib/siteUrl';
import { writeAudit } from '@/lib/adminState';

/** Shared by the admin "send" route, the scheduler and the cron route. Server only. */

export const MAX_RECIPIENTS = 1000;

export const audienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('tiers'), tiers: z.array(z.enum(['free', 'lite', 'pro', 'business', 'corporate'])).min(1) }),
  z.object({ type: z.literal('sites'), site_ids: z.array(z.string().uuid()).min(1).max(200) }),
  z.object({ type: z.literal('status'), status: z.enum(['restricted', 'suspended', 'banned']) }),
]);
export type Audience = z.infer<typeof audienceSchema>;

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Who an audience points at: the owners of the matching sites. */
export async function resolveOwners(audience: Audience): Promise<{ ownerIds: string[]; siteCount: number }> {
  const { data: sites } = await supabaseAdmin.from('forums').select('id, owner_id, plan_tier, plan_expires_at');
  let list = sites || [];
  if (audience.type === 'tiers') list = list.filter((s) => audience.tiers.includes(effectiveTier(s.plan_tier, s.plan_expires_at)));
  else if (audience.type === 'sites') list = list.filter((s) => audience.site_ids.includes(s.id));
  else if (audience.type === 'status') {
    const { data: st } = await supabaseAdmin.from('site_admin_state').select('site_id').eq('status', audience.status);
    const ids = new Set((st || []).map((r) => r.site_id as string));
    list = list.filter((s) => ids.has(s.id));
  }
  return { ownerIds: Array.from(new Set(list.map((s) => s.owner_id as string).filter(Boolean))), siteCount: list.length };
}

/** Sends the bell notification and/or email to each owner, ten at a time. */
export async function sendToOwners(p: { title: string; body: string; level: string; channels: string[]; ownerIds: string[] }) {
  const wantBell = p.channels.includes('bell');
  const wantEmail = p.channels.includes('email');
  let bell = 0, emailed = 0, emailSkipped = 0;
  if (!wantBell && !wantEmail) return { bell, emailed, emailSkipped };
  const paragraphs = p.body.split(/\n{2,}/).map((x) => `<p>${esc(x).replace(/\n/g, '<br/>')}</p>`).join('');
  const emailHtml = wantEmail ? emailShell(`<h2 style="margin:0 0 12px">${esc(p.title)}</h2>${paragraphs}`, 'Open your dashboard', `${siteUrl()}/developer/manage`, 'developa') : undefined;
  for (let i = 0; i < p.ownerIds.length; i += 10) {
    const results = await Promise.all(p.ownerIds.slice(i, i + 10).map((userId) => notifyUser({
      userId,
      title: p.title,
      message: p.body.length > 280 ? `${p.body.slice(0, 277)}...` : p.body,
      type: p.level === 'critical' || p.level === 'warning' ? 'system' : 'admin_message',
      isAdminSent: true,
      link: '/developer/manage',
      emailHtml,
      emailSubject: wantEmail ? p.title : undefined,
      // Notices about account or safety problems must reach the owner; ordinary news respects their email choices.
      forceEmail: wantEmail && p.level === 'critical',
    }).catch(() => null)));
    for (const r of results) {
      if (wantBell && r) bell++;
      if (wantEmail && r?.emailed) emailed++;
      else if (wantEmail) emailSkipped++;
    }
  }
  return { bell, emailed, emailSkipped };
}

/**
 * Sends every scheduled announcement whose time has come. Each one is claimed first (scheduled to sent in a single
 * update), so running this twice at once never sends anything twice. Returns how many were sent.
 */
export async function runDueAnnouncements(): Promise<number> {
  const { data: due, error } = await supabaseAdmin
    .from('platform_announcements')
    .select('id, title, body, level, audience, channels, created_by')
    .eq('status', 'scheduled')
    .lte('send_at', new Date().toISOString())
    .limit(10);
  if (error || !due?.length) {
    if (error && !isMissingRelationError(error)) console.warn('scheduled announcements read failed:', error.message);
    return 0;
  }
  let sent = 0;
  for (const a of due) {
    const { data: claimed } = await supabaseAdmin
      .from('platform_announcements')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', a.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;
    const parsed = audienceSchema.safeParse(a.audience);
    if (!parsed.success) continue;
    const { ownerIds } = await resolveOwners(parsed.data);
    const targets = ownerIds.slice(0, MAX_RECIPIENTS);
    const counts = await sendToOwners({ title: a.title, body: a.body, level: a.level, channels: a.channels || [], ownerIds: targets });
    await supabaseAdmin.from('platform_announcements').update({ recipient_count: targets.length, bell_sent: counts.bell, emailed: counts.emailed }).eq('id', a.id);
    await writeAudit({ admin_id: a.created_by || '', admin_email: 'scheduler', action: 'announcement_sent', target_type: 'announcement', target_id: a.id, detail: { title: a.title, owners: targets.length, ...counts, scheduled: true } });
    sent++;
  }
  return sent;
}
