import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { effectiveTier, PLANS } from '@/lib/plans';
import { sendSiteEmail } from '@/lib/siteMailer';
import { emailShell } from '@/lib/emailTemplates';
import { loadSiteBrand } from '@/lib/siteBrandServer';

export const dynamic = 'force-dynamic';

async function access(slug: string) {
  const a = await requireSiteAccess(slug, ['owner', 'manager', 'support']);
  if ('error' in a) return { error: a.error } as const;
  const ok = PLANS[effectiveTier(a.site.plan_tier, (a.site as { plan_expires_at?: string | null }).plan_expires_at)].directMessages;
  if (!ok) return { error: NextResponse.json({ error: 'Chatting with buyers is part of the Pro plan.' }, { status: 403 }) } as const;
  return { site: a.site } as const;
}

/**
 * Owner: with no `buyer` this lists conversations (newest first, with unread counts).
 * With `?buyer=<id>` it returns that conversation and marks the buyer's messages as read.
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const a = await access(slug);
  if ('error' in a) return a.error;
  const buyer = new URL(request.url).searchParams.get('buyer');

  if (buyer) {
    const { data } = await supabaseAdmin.from('site_messages').select('id, sender, body, created_at').eq('site_id', a.site.id).eq('buyer_id', buyer).order('created_at', { ascending: true }).limit(300);
    await supabaseAdmin.from('site_messages').update({ read_at: new Date().toISOString() }).eq('site_id', a.site.id).eq('buyer_id', buyer).eq('sender', 'buyer').is('read_at', null);
    return NextResponse.json({ messages: data || [] });
  }

  const { data: rows, error } = await supabaseAdmin.from('site_messages').select('buyer_id, sender, body, created_at, read_at').eq('site_id', a.site.id).order('created_at', { ascending: false }).limit(500);
  if (error) return NextResponse.json({ conversations: [], needs_update: true });
  const map = new Map<string, { buyer_id: string; last_body: string; last_at: string; unread: number }>();
  for (const r of rows || []) {
    const cur = map.get(r.buyer_id) || { buyer_id: r.buyer_id, last_body: r.body, last_at: r.created_at, unread: 0 };
    if (r.sender === 'buyer' && !r.read_at) cur.unread++;
    map.set(r.buyer_id, cur);
  }
  const conversations = Array.from(map.values()).slice(0, 50);
  const withNames = await Promise.all(conversations.map(async (c) => {
    const { data } = await supabaseAdmin.auth.admin.getUserById(c.buyer_id);
    const email = data?.user?.email || '';
    const name = (data?.user?.user_metadata as { full_name?: string } | undefined)?.full_name || email.split('@')[0] || 'Buyer';
    return { ...c, name, email };
  }));
  return NextResponse.json({ conversations: withNames });
}

const replySchema = z.object({ buyer_id: z.string().uuid(), body: z.string().trim().min(1).max(2000) });

/** Owner: reply to a buyer. They get an email with the reply. */
export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const a = await access(slug);
  if ('error' in a) return a.error;
  const parsed = replySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Write a reply first.' }, { status: 400 });
  const { data: existing } = await supabaseAdmin.from('site_messages').select('id').eq('site_id', a.site.id).eq('buyer_id', parsed.data.buyer_id).limit(1).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'No conversation with that buyer.' }, { status: 404 });
  const { data: msg, error } = await supabaseAdmin.from('site_messages').insert({ site_id: a.site.id, buyer_id: parsed.data.buyer_id, sender: 'owner', body: xss(parsed.data.body) }).select('id, sender, body, created_at').single();
  if (error) return NextResponse.json({ error: 'Could not send.' }, { status: 500 });
  const { data: buyer } = await supabaseAdmin.auth.admin.getUserById(parsed.data.buyer_id);
  if (buyer?.user?.email) {
    const brand = await loadSiteBrand(a.site);
    sendSiteEmail({
      to: buyer.user.email,
      subject: `${a.site.name} replied to your message`,
      html: emailShell(`<h2>${xss(a.site.name)} replied</h2><p>${xss(parsed.data.body).slice(0, 500)}</p>`, 'Open the store', `https://${a.site.slug}.developa.me`, brand),
    }).catch(() => undefined);
  }
  return NextResponse.json({ message: msg }, { status: 201 });
}
