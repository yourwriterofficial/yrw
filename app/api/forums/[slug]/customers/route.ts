import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { isMissingRelationError, requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';

function csvEscape(v: unknown): string {
  const s = String(v ?? '').replace(/\r?\n/g, ' ');
  // Prevent CSV spreadsheet formula injection when opened in Excel/Sheets
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

const addSubSchema = z.object({
  email: z.string().trim().email().max(150),
  name: z.string().trim().max(100).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  marketing_consent: z.boolean().optional().default(true),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager', 'support']);
    if ('error' in access) return access.error;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);

    if (format === 'csv' && !plan.customerExport) {
      return NextResponse.json({ error: 'Customer CSV export is available on Pro and Business plans.' }, { status: 403 });
    }

    const [ordersRes, subsRes] = await Promise.all([
      supabaseAdmin
        .from('site_orders')
        .select('buyer_name, buyer_email, buyer_phone, total_amount, payment_status, created_at')
        .eq('site_id', access.site.id)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from('site_subscribers')
        .select('email, name, phone, marketing_consent, unsubscribed_at, created_at')
        .eq('site_id', access.site.id),
    ]);

    if (ordersRes.error) throw ordersRes.error;

    const subMap = new Map<string, { name: string; phone: string; marketing_consent: boolean; unsubscribed_at: string | null }>();
    if (!subsRes.error && subsRes.data) {
      for (const s of subsRes.data) {
        subMap.set((s.email || '').toLowerCase(), {
          name: s.name || '',
          phone: s.phone || '',
          marketing_consent: !!s.marketing_consent,
          unsubscribed_at: s.unsubscribed_at,
        });
      }
    }

    const byEmail = new Map<
      string,
      {
        email: string;
        name: string;
        phone: string;
        orders: number;
        paid_orders: number;
        total_spent: number;
        last_order_at: string;
        subscribed: boolean;
      }
    >();

    for (const o of ordersRes.data || []) {
      const email = (o.buyer_email || '').trim().toLowerCase();
      if (!email) continue;
      const cur = byEmail.get(email) || {
        email,
        name: o.buyer_name || '',
        phone: o.buyer_phone || '',
        orders: 0,
        paid_orders: 0,
        total_spent: 0,
        last_order_at: o.created_at,
        subscribed: false,
      };
      cur.orders += 1;
      if (o.payment_status === 'paid') {
        cur.paid_orders += 1;
        cur.total_spent += Number(o.total_amount) || 0;
      }
      if (!cur.name && o.buyer_name) cur.name = o.buyer_name;
      if (!cur.phone && o.buyer_phone) cur.phone = o.buyer_phone;
      if (o.created_at > cur.last_order_at) cur.last_order_at = o.created_at;
      byEmail.set(email, cur);
    }

    for (const [email, sub] of Array.from(subMap.entries())) {
      const existing = byEmail.get(email);
      const activeSub = sub.marketing_consent && !sub.unsubscribed_at;
      if (existing) {
        existing.subscribed = activeSub;
        if (!existing.name && sub.name) existing.name = sub.name;
        if (!existing.phone && sub.phone) existing.phone = sub.phone;
      } else {
        byEmail.set(email, {
          email,
          name: sub.name,
          phone: sub.phone,
          orders: 0,
          paid_orders: 0,
          total_spent: 0,
          last_order_at: '',
          subscribed: activeSub,
        });
      }
    }

    const customers = Array.from(byEmail.values()).sort((a, b) => b.total_spent - a.total_spent || b.orders - a.orders);

    if (format === 'csv') {
      const header = ['Name', 'Email', 'Phone', 'Orders', 'Paid Orders', 'Total Spent', 'Last Order', 'Subscribed'].join(',');
      const lines = customers.map((c) =>
        [
          csvEscape(c.name),
          csvEscape(c.email),
          csvEscape(c.phone),
          c.orders,
          c.paid_orders,
          c.total_spent.toFixed(2),
          csvEscape(c.last_order_at),
          c.subscribed ? 'Yes' : 'No',
        ].join(',')
      );
      return new Response([header, ...lines].join('\r\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${access.site.slug}-customers.csv"`,
        },
      });
    }

    return NextResponse.json({ customers });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load customers' }, { status: 500 });
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

    const raw = await request.json().catch(() => null);
    const parsed = addSubSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid subscriber' }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const { data, error } = await supabaseAdmin
      .from('site_subscribers')
      .upsert(
        {
          site_id: access.site.id,
          email,
          name: xss(parsed.data.name),
          phone: xss(parsed.data.phone),
          source: 'manual',
          marketing_consent: parsed.data.marketing_consent,
          unsubscribed_at: parsed.data.marketing_consent ? null : new Date().toISOString(),
          unsubscribe_token: crypto.randomBytes(16).toString('hex'),
        },
        { onConflict: 'site_id,email' }
      )
      .select('id, email, name, marketing_consent')
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ error: 'This is not available right now. Please try again in a few minutes.' }, { status: 503 });
      }
      throw error;
    }

    return NextResponse.json({ subscriber: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save subscriber' }, { status: 500 });
  }
}
