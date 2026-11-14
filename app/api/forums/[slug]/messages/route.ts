import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/forumServer';
import { effectiveTier, PLANS } from '@/lib/plans';
import { overLimit } from '@/lib/rateLimit';
import { pluginOn } from '@/lib/plugins';
import { readPluginSettings } from '@/lib/pluginsServer';
import { sendSiteEmail } from '@/lib/siteMailer';
import { emailShell } from '@/lib/emailTemplates';
import { siteUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

async function chatSite(slug: string) {
  const { data } = await supabaseAdmin
    .from('forums')
    .select('id, slug, name, owner_id, plan_tier, plan_expires_at, is_public')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle();
  if (!data || !data.is_public) return null;
  const settings = await readPluginSettings(data.id);
  return { site: data, enabled: PLANS[effectiveTier(data.plan_tier, data.plan_expires_at)].directMessages && pluginOn('chat', data.plan_tier, data.plan_expires_at, settings) };
}

/** Buyer: my conversation with this seller. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const c = await chatSite(slug);
  if (!c) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (!c.enabled) return NextResponse.json({ enabled: false, messages: [] });
  if (!user) return NextResponse.json({ enabled: true, signed_in: false, messages: [] });
  const { data } = await supabaseAdmin
    .from('site_messages')
    .select('id, sender, body, created_at')
    .eq('site_id', c.site.id)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: true })
    .limit(200);
  return NextResponse.json({ enabled: true, signed_in: true, messages: data || [] });
}

const sendSchema = z.object({ body: z.string().trim().min(1).max(2000) });

/** Buyer: send the seller a message. The owner gets an email and sees it in Admin. */
export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to message the seller.' }, { status: 401 });
  if (overLimit(`dm:${user.id}`, 30, 60 * 60 * 1000)) return NextResponse.json({ error: 'You are sending messages too quickly.' }, { status: 429 });
  const c = await chatSite(slug);
  if (!c || !c.enabled) return NextResponse.json({ error: 'This seller does not take messages here. Try WhatsApp.' }, { status: 403 });
  if (c.site.owner_id === user.id) return NextResponse.json({ error: 'This is your own site.' }, { status: 400 });
  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });

  const { data: last } = await supabaseAdmin.from('site_messages').select('created_at, sender').eq('site_id', c.site.id).eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: msg, error } = await supabaseAdmin
    .from('site_messages')
    .insert({ site_id: c.site.id, buyer_id: user.id, sender: 'buyer', body: xss(parsed.data.body) })
    .select('id, sender, body, created_at')
    .single();
  if (error) return NextResponse.json({ error: 'Chat is not switched on yet. Please try again soon.' }, { status: 503 });

  // Email the owner about a new conversation, or when the buyer writes again after the owner replied.
  if (!last || last.sender === 'owner') {
    const { data: owner } = await supabaseAdmin.auth.admin.getUserById(c.site.owner_id);
    if (owner?.user?.email) {
      sendSiteEmail({
        to: owner.user.email,
        subject: `${c.site.name}: new message from a buyer`,
        html: emailShell(`<h2>New message</h2><p>${xss(parsed.data.body).slice(0, 300)}</p>`, 'Reply in Admin', `${siteUrl()}/developer/manage?site=${encodeURIComponent(c.site.slug)}`, 'developa'),
      }).catch(() => undefined);
    }
  }
  return NextResponse.json({ message: msg }, { status: 201 });
}
