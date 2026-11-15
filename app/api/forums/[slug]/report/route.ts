import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { isMissingRelationError, supabaseAdmin } from '@/lib/forumServer';
import { clientIp, overLimit } from '@/lib/rateLimit';

const schema = z.object({
  target_type: z.enum(['site', 'product', 'thread']).default('site'),
  target_id: z.string().uuid().optional(),
  reason: z.enum(['scam', 'counterfeit', 'illegal', 'abuse', 'spam', 'other']),
  details: z.string().trim().max(1000).optional().default(''),
  email: z.string().trim().email().max(150).optional().or(z.literal('')),
});

/**
 * Anyone can report a store, one of its products or a post. Limited per visitor, and the same visitor reporting
 * the same thing again within a day is counted once. The reporter's address is stored only as a hash.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const ip = clientIp(request);
  if (overLimit(`report:${ip}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: 'You have sent several reports. Please wait a while before sending another.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a reason for the report.' }, { status: 400 });
  const d = parsed.data;
  if (d.target_type !== 'site' && !d.target_id) return NextResponse.json({ error: 'Missing what you are reporting.' }, { status: 400 });

  const { data: site } = await supabaseAdmin.from('forums').select('id').eq('slug', slug.toLowerCase().trim()).maybeSingle();
  if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });

  // The item must belong to this site.
  if (d.target_type === 'product') {
    const { data } = await supabaseAdmin.from('site_products').select('id').eq('id', d.target_id!).eq('site_id', site.id).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
  } else if (d.target_type === 'thread') {
    const { data } = await supabaseAdmin.from('forum_threads').select('id').eq('id', d.target_id!).eq('forum_id', site.id).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  }

  const reporterKey = createHash('sha256').update(`${ip}|${site.id}|${d.target_type}|${d.target_id || ''}`).digest('hex').slice(0, 32);
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: dup, error: dupErr } = await supabaseAdmin.from('site_reports').select('id').eq('reporter_key', reporterKey).gte('created_at', since).limit(1);
  if (dupErr) return NextResponse.json({ error: isMissingRelationError(dupErr) ? 'Reports are not switched on yet. Please email support@developa.me.' : 'Could not send the report.' }, { status: isMissingRelationError(dupErr) ? 503 : 500 });
  if (dup && dup.length) return NextResponse.json({ ok: true, duplicate: true });

  let reporterId: string | null = null;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    reporterId = user?.id ?? null;
  } catch { /* anonymous report */ }

  const { error } = await supabaseAdmin.from('site_reports').insert({
    site_id: site.id,
    target_type: d.target_type,
    target_id: d.target_id ?? null,
    reason: d.reason,
    details: xss(d.details),
    reporter_email: d.email || '',
    reporter_id: reporterId,
    reporter_key: reporterKey,
  });
  if (error) return NextResponse.json({ error: 'Could not send the report.' }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
