import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { isPlatformAdmin, supabaseAdmin } from '@/lib/forumServer';
import { sendSystemEmail } from '@/lib/emailService';
import { emailShell } from '@/lib/emailTemplates';
import { siteUrl } from '@/lib/siteUrl';

const replySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'resolved']),
  admin_reply: z.string().trim().max(3000).optional().default(''),
});

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET() {
  try {
    if (!(await isPlatformAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('site_support_requests')
      .select('id, site_id, user_id, subject, message, whatsapp_number, status, admin_reply, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      if (/relation .*site_support_requests.* does not exist/i.test(error.message)) {
        return NextResponse.json({ requests: [], needs_update: true });
      }
      throw error;
    }

    const siteIds = Array.from(new Set((data || []).map((r) => r.site_id)));
    const { data: sites } = siteIds.length > 0
      ? await supabaseAdmin.from('forums').select('id, slug, name').in('id', siteIds)
      : { data: [] };
    const siteMap = new Map((sites || []).map((s) => [s.id as string, { slug: s.slug as string, name: s.name as string }]));

    const requests = (data || []).map((r) => ({
      ...r,
      site_name: siteMap.get(r.site_id)?.name || 'Store',
      site_slug: siteMap.get(r.site_id)?.slug || '',
    }));

    return NextResponse.json({ requests });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load support inbox' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await isPlatformAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = replySchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid support update' }, { status: 400 });

    const { data: updated, error } = await supabaseAdmin
      .from('site_support_requests')
      .update({
        status: parsed.data.status,
        admin_reply: xss(parsed.data.admin_reply),
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.id)
      .select('*')
      .single();

    if (error) throw error;

    if (parsed.data.admin_reply.trim()) {
      try {
        const [{ data: u }, { data: site }] = await Promise.all([
          supabaseAdmin.auth.admin.getUserById(updated.user_id),
          supabaseAdmin.from('forums').select('slug, name').eq('id', updated.site_id).maybeSingle(),
        ]);
        if (u?.user?.email) {
          await sendSystemEmail({
            to: u.user.email,
            subject: `Support update for ${site?.name || 'your site'}: ${updated.subject}`,
            html: emailShell(
              `<p>Status: <strong>${esc(updated.status.replace('_', ' '))}</strong></p><p>${esc(parsed.data.admin_reply)}</p>`,
              'Open your plan tab',
              `${siteUrl()}/developer/manage${site?.slug ? `?site=${encodeURIComponent(site.slug)}` : ''}`,
              'developa'
            ),
          }).catch(() => {});
        }
      } catch {
        // Non-blocking email reply
      }
    }

    return NextResponse.json({ request: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to reply' }, { status: 500 });
  }
}
