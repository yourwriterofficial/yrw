import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import {
  isMissingRelationError,
  readExtendedSite,
  requireSiteAccess,
  resolveUserSiteRole,
  supabaseAdmin,
} from '@/lib/forumServer';
import { planFor } from '@/lib/plans';
import { clientIp, overLimit } from '@/lib/rateLimit';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { sendSystemEmail } from '@/lib/emailService';
import { emailShell } from '@/lib/emailTemplates';
import { loadSiteBrand } from '@/lib/siteBrandServer';
import { siteUrl } from '@/lib/siteUrl';

const createServiceSchema = z.object({
  action: z.literal('create_service'),
  title: z.string().trim().min(2, 'Service title is required').max(120),
  description: z.string().trim().max(400).optional().default(''),
  duration_mins: z.number().int().min(5).max(480).optional().default(30),
  price: z.number().min(0).max(10_000_000).optional().default(0),
  slot_days: z.array(z.string().trim().max(10)).min(1).max(7).optional().default(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
  slot_hours: z.array(z.string().trim().max(10)).min(1).max(16).optional().default(['09:00', '11:00', '14:00', '16:00']),
});

const bookSchema = z.object({
  action: z.literal('book'),
  service_id: z.string().uuid(),
  buyer_name: z.string().trim().min(2, 'Your name is required').max(100),
  buyer_email: z.string().trim().email('Valid email required').max(150),
  buyer_phone: z.string().trim().max(30).optional().default(''),
  slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  slot_time: z.string().trim().min(3).max(10),
  notes: z.string().trim().max(500).optional().default(''),
});

const patchSchema = z.union([
  z.object({ service_id: z.string().uuid(), is_active: z.boolean() }),
  z.object({ id: z.string().uuid(), status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']) }),
]);

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, slug, name, owner_id, plan_tier, currency')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const { data: svcData, error: svcErr } = await supabaseAdmin
      .from('site_booking_services')
      .select('id, site_id, title, description, duration_mins, price, slot_days, slot_hours, is_active, created_at')
      .eq('site_id', site.id)
      .order('created_at', { ascending: true });

    if (svcErr) {
      if (isMissingRelationError(svcErr)) {
        return NextResponse.json({ services: [], takenSlots: [], bookings: [], tableMissing: true });
      }
      throw svcErr;
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const ext = await readExtendedSite(site.id);
    const myRole = await resolveUserSiteRole(
      site.id,
      site.owner_id,
      site.plan_tier,
      ext?.plan_expires_at,
      user?.id,
      user?.email
    );
    const canManage = myRole === 'owner' || myRole === 'manager' || myRole === 'support';
    const todayUtc = new Date().toISOString().slice(0, 10);

    const { data: takenData } = await supabaseAdmin
      .from('site_bookings')
      .select('service_id, slot_date, slot_time')
      .eq('site_id', site.id)
      .neq('status', 'cancelled')
      .gte('slot_date', todayUtc)
      .limit(300);

    let bookings: unknown[] = [];
    if (canManage) {
      const { data: rows } = await supabaseAdmin
        .from('site_bookings')
        .select('id, service_id, buyer_name, buyer_email, buyer_phone, slot_date, slot_time, notes, status, created_at')
        .eq('site_id', site.id)
        .order('slot_date', { ascending: true })
        .order('slot_time', { ascending: true })
        .limit(200);
      bookings = rows || [];
    }

    const services = canManage ? svcData || [] : (svcData || []).filter((s) => s.is_active);
    return NextResponse.json({ services, takenSlots: takenData || [], bookings });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load bookings' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const raw = await request.json().catch(() => null);

    if (raw?.action === 'create_service') {
      const access = await requireSiteAccess(slug, ['owner', 'manager']);
      if ('error' in access) return access.error;
      const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
      if (!plan.bookings) {
        return NextResponse.json({ error: 'Appointment bookings are available on the Business plan.' }, { status: 403 });
      }
      const parsed = createServiceSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid service' }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from('site_booking_services')
        .insert({
          site_id: access.site.id,
          title: xss(parsed.data.title),
          description: xss(parsed.data.description),
          duration_mins: parsed.data.duration_mins,
          price: parsed.data.price,
          slot_days: parsed.data.slot_days,
          slot_hours: parsed.data.slot_hours,
          is_active: true,
        })
        .select('*')
        .single();
      if (error) {
        if (isMissingRelationError(error)) {
          return NextResponse.json({ error: 'Bookings need the latest database update first.' }, { status: 503 });
        }
        throw error;
      }
      return NextResponse.json({ service: data }, { status: 201 });
    }

    if (overLimit(`booking:${clientIp(request)}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many booking attempts. Please wait a few minutes.' }, { status: 429 });
    }

    const parsed = bookSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check booking details' }, { status: 400 });
    }

    const todayUtc = new Date().toISOString().slice(0, 10);
    if (parsed.data.slot_date < todayUtc) {
      return NextResponse.json({ error: 'Choose today or a future date.' }, { status: 400 });
    }

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, slug, name, owner_id')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const { data: service } = await supabaseAdmin
      .from('site_booking_services')
      .select('id, title')
      .eq('id', parsed.data.service_id)
      .eq('site_id', site.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!service) return NextResponse.json({ error: 'Service not available.' }, { status: 404 });

    const { data: booking, error } = await supabaseAdmin
      .from('site_bookings')
      .insert({
        site_id: site.id,
        service_id: service.id,
        buyer_name: xss(parsed.data.buyer_name),
        buyer_email: parsed.data.buyer_email.toLowerCase(),
        buyer_phone: xss(parsed.data.buyer_phone),
        slot_date: parsed.data.slot_date,
        slot_time: xss(parsed.data.slot_time),
        notes: xss(parsed.data.notes),
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505' || /duplicate key/i.test(error.message)) {
        return NextResponse.json({ error: 'That time slot was just booked. Please pick another time.' }, { status: 409 });
      }
      if (isMissingRelationError(error)) {
        return NextResponse.json({ error: 'Bookings need the latest database update first.' }, { status: 503 });
      }
      throw error;
    }

    const storeHref = `${siteUrl()}/forums/${site.slug}`;
    sendSystemEmail({
      to: parsed.data.buyer_email.toLowerCase(),
      subject: `${site.name}: booking request received (${service.title})`,
      html: emailShell(
        `<p>Hi ${esc(parsed.data.buyer_name)}, your booking request for <strong>${esc(service.title)}</strong> on <strong>${esc(parsed.data.slot_date)} at ${esc(parsed.data.slot_time)}</strong> was received. The owner will confirm shortly.</p>`,
        `Visit ${site.name}`,
        storeHref,
        await loadSiteBrand(site)
      ),
    }).catch(() => {});

    try {
      const { notifyUser } = await import('@/lib/notify');
      await notifyUser({
        userId: site.owner_id,
        title: `New booking on ${site.name}`,
        message: `${parsed.data.buyer_name} booked ${service.title} on ${parsed.data.slot_date} at ${parsed.data.slot_time}.`,
        type: 'order_update',
        link: `/developer/manage?site=${site.slug}`,
      });
    } catch {
      // Non-blocking notification
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Booking failed' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager', 'support']);
    if ('error' in access) return access.error;

    const raw = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid update' }, { status: 400 });

    if ('service_id' in parsed.data) {
      const { data, error } = await supabaseAdmin
        .from('site_booking_services')
        .update({ is_active: parsed.data.is_active })
        .eq('id', parsed.data.service_id)
        .eq('site_id', access.site.id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ service: data });
    }

    const { data: booking, error } = await supabaseAdmin
      .from('site_bookings')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('site_id', access.site.id)
      .select('*')
      .single();

    if (error) throw error;

    if (booking.buyer_email && (parsed.data.status === 'confirmed' || parsed.data.status === 'cancelled')) {
      sendSystemEmail({
        to: booking.buyer_email,
        subject: `${access.site.name}: booking ${parsed.data.status} (${booking.slot_date} ${booking.slot_time})`,
        html: emailShell(
          `<p>Hi ${esc(booking.buyer_name)}, your appointment on <strong>${esc(booking.slot_date)} at ${esc(booking.slot_time)}</strong> is now <strong>${esc(parsed.data.status)}</strong>.</p>`,
          `Visit ${access.site.name}`,
          `${siteUrl()}/forums/${access.site.slug}`,
          await loadSiteBrand(access.site)
        ),
      }).catch(() => {});
    }

    return NextResponse.json({ booking });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update booking' }, { status: 500 });
  }
}
