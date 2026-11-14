import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { supabaseAdmin, isPlatformAdmin } from '@/lib/forumServer';

const adSchema = z.object({
  title: z.string().trim().min(2).max(100),
  body: z.string().trim().max(240).optional().default(''),
  link_url: z.string().trim().max(500).refine((v) => v === '' || /^https?:\/\//.test(v), 'Links must start with http:// or https://').optional().default(''),
  image_url: z.string().trim().max(500).refine((v) => v === '' || /^https:\/\//.test(v), 'Images must be https links').optional().default(''),
  placement: z.enum(['banner', 'footer']).default('banner'),
  target_site_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

async function guard() {
  return (await isPlatformAdmin()) ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const { data, error } = await supabaseAdmin.from('platform_site_ads').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ads: [], needs_update: true });
  return NextResponse.json({ ads: data || [] });
}

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = adSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid ad' }, { status: 400 });
  const d = parsed.data;
  const { data, error } = await supabaseAdmin
    .from('platform_site_ads')
    .insert({ ...d, title: xss(d.title), body: xss(d.body), target_site_id: d.target_site_id ?? null, starts_at: d.starts_at ?? null, ends_at: d.ends_at ?? null })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Ads need the latest database update first.' }, { status: 503 });
  return NextResponse.json({ ad: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body?.id || typeof body.is_active !== 'boolean') return NextResponse.json({ error: 'Missing id or state' }, { status: 400 });
  const { error } = await supabaseAdmin.from('platform_site_ads').update({ is_active: body.is_active }).eq('id', body.id);
  if (error) return NextResponse.json({ error: 'Could not update the ad.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await supabaseAdmin.from('platform_site_ads').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
