import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { requireAdmin } from '@/lib/adminAuth';
import { isMissingRelationError, supabaseAdmin } from '@/lib/forumServer';
import { writeAudit } from '@/lib/adminState';
import { effectiveTier } from '@/lib/plans';
import { notifyUser } from '@/lib/notify';
import { emailShell } from '@/lib/emailTemplates';
import { siteUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

const MAX_RECIPIENTS = 1000;

const audienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('tiers'), tiers: z.array(z.enum(['free', 'lite', 'pro', 'business', 'corporate'])).min(1) }),
  z.object({ type: z.literal('sites'), site_ids: z.array(z.string().uuid()).min(1).max(200) }),
  z.object({ type: z.literal('status'), status: z.enum(['restricted', 'suspended', 'banned']) }),
]);

const sendSchema = z.object({
  title: z.string().trim().min(3, 'Add a short title').max(120),
  body: z.string().trim().min(3, 'Write the message').max(4000),
  level: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  audience: audienceSchema,
  channels: z.array(z.enum(['inbox', 'bell', 'email'])).min(1, 'Pick at least one place to send it'),
  pinned: z.boolean().default(false),
  expires_at: z.string().datetime().nullable().optional(),
  dry_run: z.boolean().default(false),
});

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Who an audience points at: the owners of the matching sites. */
async function resolveOwners(audience: z.infer<typeof audienceSchema>): Promise<{ ownerIds: string[]; siteCount: number }> {
  const { data: sites } = await supabaseAdmin.from('forums').select('id, owner_id, plan_tier, plan_expires_at');
  let list = sites || [];
  if (audience.type === 'tiers') list = list.filter((s) => audience.tiers.includes(effectiveTier(s.plan_tier, s.plan_expires_at)));
  else if (audience.type === 'sites') list = list.filter((s) => audience.site_ids.includes(s.id));
  else if (audience.type === 'status') {
    const { data: st } = await supabaseAdmin.from('site_admin_state').select('site_id').eq('status', audience.status);
    const ids = new Set((st || []).map((r) => r.site_id as string));
    list = list.filter((s) => ids.has(s.id));
  }
  const owners = Array.from(new Set(list.map((s) => s.owner_id as string).filter(Boolean)));
  return { ownerIds: owners, siteCount: list.length };
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { data, error } = await supabaseAdmin.from('platform_announcements').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ announcements: [], needs_update: isMissingRelationError(error) });
  return NextResponse.json({ announcements: data || [] });
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  await supabaseAdmin.from('platform_announcements').delete().eq('id', id);
  await writeAudit({ admin_id: guard.userId, admin_email: guard.email, action: 'announcement_deleted', target_type: 'announcement', target_id: id });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid announcement.' }, { status: 400 });
  const d = parsed.data;

  const { ownerIds, siteCount } = await resolveOwners(d.audience);
  if (ownerIds.length === 0) return NextResponse.json({ error: 'No site owners match that audience.' }, { status: 400 });
  if (d.dry_run) return NextResponse.json({ ok: true, owners: ownerIds.length, sites: siteCount });
  const targets = ownerIds.slice(0, MAX_RECIPIENTS);

  const title = xss(d.title);
  const body = xss(d.body);
  let announcementId: string | null = null;

  if (d.channels.includes('inbox')) {
    const { data, error } = await supabaseAdmin.from('platform_announcements').insert({
      title, body, level: d.level, audience: d.audience, channels: d.channels, pinned: d.pinned,
      expires_at: d.expires_at ?? null, recipient_count: targets.length, created_by: guard.userId,
    }).select('id').single();
    if (error) return NextResponse.json({ error: isMissingRelationError(error) ? 'Announcements need the latest database update first (run the platform_admin_controls migration).' : 'Could not save the announcement.' }, { status: isMissingRelationError(error) ? 503 : 500 });
    announcementId = data.id as string;
  }

  const wantBell = d.channels.includes('bell');
  const wantEmail = d.channels.includes('email');
  let bell = 0, emailed = 0, emailSkipped = 0;

  if (wantBell || wantEmail) {
    const paragraphs = body.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`).join('');
    const emailHtml = wantEmail ? emailShell(`<h2 style="margin:0 0 12px">${esc(title)}</h2>${paragraphs}`, 'Open your dashboard', `${siteUrl()}/developer/manage`, 'developa') : undefined;
    for (let i = 0; i < targets.length; i += 10) {
      const batch = targets.slice(i, i + 10);
      const results = await Promise.all(batch.map((userId) => notifyUser({
        userId,
        title,
        message: body.length > 280 ? `${body.slice(0, 277)}...` : body,
        type: d.level === 'critical' || d.level === 'warning' ? 'system' : 'admin_message',
        isAdminSent: true,
        link: '/developer/manage',
        emailHtml,
        emailSubject: wantEmail ? title : undefined,
        // Notices about account or safety problems must reach the owner; ordinary news respects their email choices.
        forceEmail: wantEmail && d.level === 'critical',
      }).catch(() => null)));
      for (const r of results) {
        if (wantBell && r) bell++;
        if (wantEmail && r?.emailed) emailed++;
        else if (wantEmail) emailSkipped++;
      }
    }
  }

  await writeAudit({ admin_id: guard.userId, admin_email: guard.email, action: 'announcement_sent', target_type: 'announcement', target_id: announcementId || undefined, detail: { title, audience: d.audience, channels: d.channels, owners: targets.length, bell, emailed, emailSkipped } });
  return NextResponse.json({ ok: true, owners: targets.length, truncated: ownerIds.length > targets.length, bell, emailed, emailSkipped, inbox: Boolean(announcementId) }, { status: 201 });
}
