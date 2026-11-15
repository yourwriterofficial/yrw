import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { requireAdmin } from '@/lib/adminAuth';
import { isMissingRelationError, supabaseAdmin } from '@/lib/forumServer';
import { writeAudit } from '@/lib/adminState';
import { audienceSchema, MAX_RECIPIENTS, resolveOwners, runDueAnnouncements, sendToOwners } from '@/lib/announcements';

export const dynamic = 'force-dynamic';

const sendSchema = z.object({
  title: z.string().trim().min(3, 'Add a short title').max(120),
  body: z.string().trim().min(3, 'Write the message').max(4000),
  level: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  audience: audienceSchema,
  channels: z.array(z.enum(['inbox', 'bell', 'email'])).min(1, 'Pick at least one place to send it'),
  pinned: z.boolean().default(false),
  expires_at: z.string().datetime().nullable().optional(),
  /** When set and at least two minutes away, the announcement is saved and sent later. */
  send_at: z.string().datetime().nullable().optional(),
  dry_run: z.boolean().default(false),
});

const NEEDS_DB = 'Announcements need the latest database updates first (run the platform_admin_controls and reports_scheduling_ad_stats migrations).';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  // Opening this screen also sends anything that is due, so schedules work even without a timer.
  await runDueAnnouncements().catch(() => 0);
  const { data, error } = await supabaseAdmin.from('platform_announcements').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ announcements: [], needs_update: isMissingRelationError(error) });
  return NextResponse.json({ announcements: data || [] });
}

/** Removes an announcement. A scheduled one is cancelled instead, so the history keeps a record. */
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  const { data: row } = await supabaseAdmin.from('platform_announcements').select('status').eq('id', id).maybeSingle();
  if (row?.status === 'scheduled') {
    await supabaseAdmin.from('platform_announcements').update({ status: 'cancelled' }).eq('id', id).eq('status', 'scheduled');
    await writeAudit({ admin_id: guard.userId, admin_email: guard.email, action: 'announcement_cancelled', target_type: 'announcement', target_id: id });
    return NextResponse.json({ ok: true, cancelled: true });
  }
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
  const later = d.send_at && new Date(d.send_at).getTime() > Date.now() + 2 * 60_000;

  if (later) {
    const { data, error } = await supabaseAdmin.from('platform_announcements').insert({
      title, body, level: d.level, audience: d.audience, channels: d.channels, pinned: d.pinned,
      expires_at: d.expires_at ?? null, recipient_count: 0, created_by: guard.userId, status: 'scheduled', send_at: d.send_at,
    }).select('id').single();
    if (error) return NextResponse.json({ error: isMissingRelationError(error) || /status|send_at/.test(error.message) ? NEEDS_DB : 'Could not schedule it.' }, { status: 503 });
    await writeAudit({ admin_id: guard.userId, admin_email: guard.email, action: 'announcement_scheduled', target_type: 'announcement', target_id: data.id as string, detail: { title, send_at: d.send_at, audience: d.audience, channels: d.channels } });
    return NextResponse.json({ ok: true, scheduled: true, send_at: d.send_at, owners: targets.length }, { status: 201 });
  }

  let announcementId: string | null = null;
  if (d.channels.includes('inbox')) {
    const { data, error } = await supabaseAdmin.from('platform_announcements').insert({
      title, body, level: d.level, audience: d.audience, channels: d.channels, pinned: d.pinned,
      expires_at: d.expires_at ?? null, recipient_count: targets.length, created_by: guard.userId,
    }).select('id').single();
    if (error) return NextResponse.json({ error: isMissingRelationError(error) ? NEEDS_DB : 'Could not save the announcement.' }, { status: isMissingRelationError(error) ? 503 : 500 });
    announcementId = data.id as string;
  }

  const counts = await sendToOwners({ title, body, level: d.level, channels: d.channels, ownerIds: targets });
  if (announcementId && (counts.bell || counts.emailed)) {
    await supabaseAdmin.from('platform_announcements').update({ bell_sent: counts.bell, emailed: counts.emailed }).eq('id', announcementId);
  }
  await writeAudit({ admin_id: guard.userId, admin_email: guard.email, action: 'announcement_sent', target_type: 'announcement', target_id: announcementId || undefined, detail: { title, audience: d.audience, channels: d.channels, owners: targets.length, ...counts } });
  return NextResponse.json({ ok: true, owners: targets.length, truncated: ownerIds.length > targets.length, ...counts, inbox: Boolean(announcementId) }, { status: 201 });
}
