import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { ingestInbound, updateThread } from '@/lib/inbox';
import { planFor } from '@/lib/plans';
import { overLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const SUPPORT_ADDRESS = 'support@developa.me';
const subjectFor = (name: string, slug: string) => `Support: ${name} (${slug})`;

const schema = z.object({ message: z.string().trim().min(2, 'Write your message first').max(3000, 'That message is too long') });

/** The conversation between this store's owner and the Developa team, oldest first. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const a = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in a) return a.error;
    const email = (a.user.email || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ messages: [] });

    const { data: threads } = await supabaseAdmin
      .from('inbox_threads')
      .select('id, status')
      .eq('brand', 'developa')
      .eq('customer_email', email)
      .ilike('subject', `%(${a.site.slug})%`)
      .neq('status', 'spam');
    const ids = (threads || []).map((t) => t.id as string);
    if (ids.length === 0) return NextResponse.json({ messages: [] });

    const { data: msgs } = await supabaseAdmin
      .from('inbox_messages')
      .select('id, direction, body_text, created_at')
      .in('thread_id', ids)
      .order('created_at', { ascending: true })
      .limit(200);

    const messages = (msgs || []).map((m) => ({
      id: m.id as string,
      from: m.direction === 'inbound' ? 'you' : 'team',
      text: String(m.body_text || '').slice(0, 4000),
      at: m.created_at as string,
    }));
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: 'Could not load your messages right now. Please try again shortly.' }, { status: 500 });
  }
}

/** Sends a message to the Developa team. It lands in the Developa support inbox in the admin. */
export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const a = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in a) return a.error;
    if (overLimit(`support-chat:${a.user.id}`, 8, 10 * 60_000)) {
      return NextResponse.json({ error: 'You are sending messages very quickly. Please wait a few minutes and try again.' }, { status: 429 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check your message' }, { status: 400 });

    const email = (a.user.email || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Your account has no email address, so we cannot reply to you.' }, { status: 400 });
    const name = String((a.user.user_metadata as { full_name?: string } | undefined)?.full_name || email.split('@')[0]);
    const site = a.site as { name: string; slug: string; plan_tier?: string; plan_expires_at?: string | null };
    const plan = planFor(site.plan_tier, site.plan_expires_at);

    // The store's details go at the top, so the person answering knows who they are helping.
    const text = `${parsed.data.message}\n\n-- \nStore: ${site.name} (${site.slug}.developa.me)\nPlan: ${plan.name}`;
    const res = await ingestInbound({ to: SUPPORT_ADDRESS, from: email, fromName: name, subject: subjectFor(site.name, site.slug), text });
    if (plan.prioritySupport) await updateThread(res.thread_id, { priority: 'high' }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not send your message right now. Please try again, or message us on WhatsApp.' }, { status: 500 });
  }
}
