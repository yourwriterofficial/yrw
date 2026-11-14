import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isMissingRelationError, requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';
import { sendSystemEmail } from '@/lib/emailService';
import { emailShell } from '@/lib/emailTemplates';
import { siteUrl } from '@/lib/siteUrl';

const MAX_STAFF_SEATS = 5;

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(150),
  role: z.enum(['manager', 'packer', 'support']),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['manager', 'packer', 'support']),
});

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner']);
    if ('error' in access) return access.error;

    const { data, error } = await supabaseAdmin
      .from('site_staff')
      .select('id, site_id, user_id, email, role, created_at')
      .eq('site_id', access.site.id)
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ staff: [], tableMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ staff: data || [], maxSeats: MAX_STAFF_SEATS });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load team' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner']);
    if ('error' in access) return access.error;

    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    if (!plan.staffAccounts) {
      return NextResponse.json({ error: 'Staff accounts with roles are available on the Business plan.' }, { status: 403 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = inviteSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid staff invite' }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    if (access.user.email && access.user.email.toLowerCase() === email) {
      return NextResponse.json({ error: 'You are already the owner of this site.' }, { status: 400 });
    }

    const { count, error: countErr } = await supabaseAdmin
      .from('site_staff')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', access.site.id);

    if (countErr) {
      if (isMissingRelationError(countErr)) {
        return NextResponse.json({ error: 'Staff accounts need the latest database update first.' }, { status: 503 });
      }
      throw countErr;
    }

    if ((count || 0) >= MAX_STAFF_SEATS) {
      return NextResponse.json({ error: `Up to ${MAX_STAFF_SEATS} team members per site.` }, { status: 403 });
    }

    let existingUserId: string | null = null;
    try {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      const match = usersData?.users?.find((u) => (u.email || '').toLowerCase() === email);
      if (match) existingUserId = match.id;
    } catch {
      // Binds automatically by email on first request if admin lookup is unavailable
    }

    const { data: row, error: insErr } = await supabaseAdmin
      .from('site_staff')
      .upsert(
        {
          site_id: access.site.id,
          user_id: existingUserId,
          email,
          role: parsed.data.role,
          invited_by: access.user.id,
        },
        { onConflict: 'site_id,email' }
      )
      .select('id, site_id, user_id, email, role, created_at')
      .single();

    if (insErr) throw insErr;

    const manageHref = `${siteUrl()}/developer/manage?site=${encodeURIComponent(access.site.slug)}`;
    sendSystemEmail({
      to: email,
      subject: `You were invited to help manage ${access.site.name}`,
      html: emailShell(
        `<h2>Team invite for ${esc(access.site.name)}</h2><p>You now have <strong>${esc(parsed.data.role)}</strong> access on <strong>${esc(access.site.name)}</strong>.</p><p>Sign in with ${esc(email)} to open the store dashboard.</p>`,
        'Open store dashboard',
        manageHref,
        'developa'
      ),
    }).catch(() => {});

    return NextResponse.json({ member: row }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to invite team member' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner']);
    if ('error' in access) return access.error;

    const raw = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid role update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('site_staff')
      .update({ role: parsed.data.role })
      .eq('id', parsed.data.id)
      .eq('site_id', access.site.id)
      .select('id, site_id, user_id, email, role, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ member: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner']);
    if ('error' in access) return access.error;

    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Missing member id' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('site_staff')
      .delete()
      .eq('id', id)
      .eq('site_id', access.site.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to remove team member' }, { status: 500 });
  }
}
