import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/forumServer';
import { clientIp, overLimit } from '@/lib/rateLimit';

const schema = z.object({ ad_id: z.string().uuid(), kind: z.enum(['impression', 'click']) });

/** Counts a view or a click on a platform ad. Fire-and-forget from the page; limited per visitor. */
export async function POST(request: Request) {
  if (overLimit(`ad-track:${clientIp(request)}`, 90, 60_000)) return NextResponse.json({ ok: true });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { error } = await supabaseAdmin.rpc('bump_platform_ad', { p_ad: parsed.data.ad_id, p_kind: parsed.data.kind });
  // Until the database update is applied there is nothing to count into; that is not an error for the visitor.
  if (error) console.warn('ad counter not updated:', error.message);
  return NextResponse.json({ ok: true });
}
