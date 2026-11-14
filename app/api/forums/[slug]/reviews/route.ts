import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { overLimit, clientIp } from '@/lib/rateLimit';
import { isMissingRelationError, readExtendedSite, requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';

const createSchema = z.object({
  product_id: z.string().uuid(),
  order_code: z.string().trim().min(3).max(40),
  email: z.string().trim().email(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1500).optional().default(''),
});

const patchSchema = z.object({
  review_id: z.string().uuid(),
  is_visible: z.boolean(),
});

function formatPublicReviewer(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Verified buyer';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const includeHidden = searchParams.get('includeHidden') === '1';

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, is_public, plan_tier')
      .eq('slug', slug)
      .maybeSingle();

    if (!site) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    let isStaff = false;
    if (!site.is_public || includeHidden) {
      const access = await requireSiteAccess(slug, ['owner', 'manager', 'support']);
      if (!('error' in access)) {
        isStaff = true;
      } else if (!site.is_public) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
    }

    let q = supabaseAdmin
      .from('site_reviews')
      .select('id, product_id, buyer_name, rating, body, is_visible, created_at')
      .eq('site_id', site.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (productId) q = q.eq('product_id', productId);
    if (!includeHidden || !isStaff) q = q.eq('is_visible', true);

    const { data: rows, error } = await q;
    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ reviews: [], tableMissing: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const reviews = (rows || []).map((r) => ({
      id: r.id,
      product_id: r.product_id,
      buyer_name: isStaff ? r.buyer_name : formatPublicReviewer(r.buyer_name),
      rating: r.rating,
      body: r.body,
      is_visible: r.is_visible,
      created_at: r.created_at,
    }));

    return NextResponse.json({ reviews });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load reviews' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    if (overLimit(`rev:${slug}:${clientIp(request)}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many review submissions. Please wait a little.' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please choose a rating (1-5) and enter your order code and email.' }, { status: 400 });
    }

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, plan_tier')
      .eq('slug', slug)
      .maybeSingle();
    if (!site) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const ext = await readExtendedSite(site.id);
    const plan = planFor(site.plan_tier, ext?.plan_expires_at);
    if (!plan.reviews) {
      return NextResponse.json({ error: 'Customer reviews are available on the Pro plan.' }, { status: 403 });
    }

    const { product_id, order_code, email, rating } = parsed.data;
    const { data: order } = await supabaseAdmin
      .from('site_orders')
      .select('id, buyer_name, payment_status, items')
      .eq('site_id', site.id)
      .eq('order_code', order_code.toUpperCase())
      .eq('buyer_email', email.toLowerCase())
      .maybeSingle();

    if (!order || order.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Only paid orders with a matching email and order code can leave a review.' }, { status: 403 });
    }

    const items = Array.isArray(order.items) ? (order.items as { product_id?: string }[]) : [];
    if (!items.some((i) => i.product_id === product_id)) {
      return NextResponse.json({ error: 'That product was not part of your order.' }, { status: 403 });
    }

    const { data: review, error } = await supabaseAdmin
      .from('site_reviews')
      .insert({
        site_id: site.id,
        product_id,
        order_id: order.id,
        buyer_name: order.buyer_name || 'Verified buyer',
        rating,
        body: xss(parsed.data.body.trim()),
        is_visible: true,
      })
      .select('id, product_id, buyer_name, rating, body, is_visible, created_at')
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ error: 'Reviews require the latest database update first.' }, { status: 503 });
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You have already reviewed this product for that order.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      review: {
        ...review,
        buyer_name: formatPublicReviewer(review.buyer_name),
      },
    }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save review' }, { status: 500 });
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

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid review update.' }, { status: 400 });
    }

    const { data: review, error } = await supabaseAdmin
      .from('site_reviews')
      .update({ is_visible: parsed.data.is_visible })
      .eq('id', parsed.data.review_id)
      .eq('site_id', access.site.id)
      .select('id, product_id, buyer_name, rating, body, is_visible, created_at')
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ error: 'Reviews require the latest database update first.' }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    return NextResponse.json({ review });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update review' }, { status: 500 });
  }
}
