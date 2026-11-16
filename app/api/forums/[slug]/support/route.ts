import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { isMissingRelationError, requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';
import { sendSystemEmail } from '@/lib/emailService';
import { emailShell } from '@/lib/emailTemplates';
import { siteUrl } from '@/lib/siteUrl';

const ticketSchema = z.object({
  subject: z.string().trim().min(3, 'Add a short subject').max(140),
  message: z.string().trim().min(10, 'Describe what you need help with').max(3000),
  whatsapp_number: z.string().trim().max(30).optional().default(''),
});

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const { data, error } = await supabaseAdmin
      .from('site_support_requests')
      .select('id, subject, message, whatsapp_number, status, admin_reply, created_at, updated_at')
      .eq('site_id', access.site.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ requests: [], tableMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ requests: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load support history' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    if (!plan.prioritySupport) {
      return NextResponse.json({ error: 'Priority support tickets are included on the Business plan.' }, { status: 403 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = ticketSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check your message' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('site_support_requests')
      .insert({
        site_id: access.site.id,
        user_id: access.user.id,
        subject: xss(parsed.data.subject),
        message: xss(parsed.data.message),
        whatsapp_number: xss(parsed.data.whatsapp_number),
        status: 'open',
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ error: 'This is not available right now. Please try again in a few minutes.' }, { status: 503 });
      }
      throw error;
    }

    // Best-effort founder alert email
    try {
      const { data: admins } = await supabaseAdmin.from('profiles').select('id').eq('is_admin', true).limit(3);
      for (const a of admins || []) {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(a.id);
        if (u?.user?.email) {
          await sendSystemEmail({
            to: u.user.email,
            subject: `[Business Support] ${access.site.name}: ${parsed.data.subject}`,
            html: emailShell(
              `<p>Store: <strong>${esc(access.site.name)}</strong> (${esc(access.site.slug)})</p><p>WhatsApp: ${esc(parsed.data.whatsapp_number || 'not provided')}</p><p>${esc(parsed.data.message)}</p>`,
              'Open admin support inbox',
              `${siteUrl()}/admin/developa-sites`,
              'developa'
            ),
          }).catch(() => {});
        }
      }
    } catch {
      // Non-blocking alert
    }

    return NextResponse.json({ request: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send request' }, { status: 500 });
  }
}
