import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { requireAdmin } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/forumServer';
import { writeAudit } from '@/lib/adminState';
import { notifyUser } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const hex = /^#[0-9a-fA-F]{6}$/;
const fieldsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  hero_headline: z.string().trim().max(160).optional(),
  hero_subheadline: z.string().trim().max(300).optional(),
  accent_color: z.string().trim().regex(hex).optional(),
  whatsapp_number: z.string().trim().max(30).optional(),
  announcement: z.string().trim().max(200).optional(),
  announcement_active: z.boolean().optional(),
  is_public: z.boolean().optional(),
}).strict();

const schema = z.object({
  site_id: z.string().uuid(),
  fields: fieldsSchema,
  reason: z.string().trim().max(300).default(''),
  notify_owner: z.boolean().default(true),
});

/**
 * Lets an admin fix a site's public details for the owner (a wrong name, an offensive headline, a bad colour).
 * Only a short list of safe fields can be changed, and the before and after values go into the history.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid changes.' }, { status: 400 });
  const { site_id, fields, reason, notify_owner } = parsed.data;
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });

  const { data: before } = await supabaseAdmin.from('forums').select(`id, slug, owner_id, ${keys.join(', ')}`).eq('id', site_id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });
  const prev = before as unknown as Record<string, unknown>;

  const clean: Record<string, unknown> = {};
  for (const k of keys) clean[k] = typeof fields[k] === 'string' ? xss(fields[k] as string) : fields[k];
  const changed = keys.filter((k) => prev[k] !== clean[k]);
  if (changed.length === 0) return NextResponse.json({ ok: true, changed: [] });

  const { error } = await supabaseAdmin.from('forums').update({ ...clean, updated_at: new Date().toISOString() }).eq('id', site_id);
  if (error) return NextResponse.json({ error: 'Could not save the changes.' }, { status: 500 });

  await writeAudit({
    admin_id: guard.userId, admin_email: guard.email, action: 'site_edited', site_id, target_id: site_id,
    detail: { reason, changes: Object.fromEntries(changed.map((k) => [k, { from: prev[k], to: clean[k] }])) },
  });
  if (notify_owner && prev.owner_id) {
    await notifyUser({ userId: prev.owner_id as string, title: 'We updated your site details', message: `developa.me changed: ${changed.join(', ').replace(/_/g, ' ')}. ${reason || ''}`.trim(), type: 'admin_message', isAdminSent: true, link: `/developer/manage?site=${prev.slug}&tab=settings` }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, changed });
}
