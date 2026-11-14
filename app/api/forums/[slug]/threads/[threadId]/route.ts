import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { readExtendedSite, resolveAuthorNames, resolveUserSiteRole, supabaseAdmin } from '@/lib/forumServer';

const replySchema = z.object({
  body: z.string().trim().min(2, 'Reply must be at least 2 characters').max(8000),
});

async function hasPaidMemberAccess(
  forumId: string,
  ownerId: string,
  planTier: string | null | undefined,
  userId: string | undefined,
  userEmail: string | undefined
): Promise<boolean> {
  if (!userId) return false;
  const ext = await readExtendedSite(forumId);
  const role = await resolveUserSiteRole(forumId, ownerId, planTier, ext?.plan_expires_at, userId, userEmail);
  if (role) return true;

  const { data: mem } = await supabaseAdmin
    .from('site_memberships')
    .select('status, expires_at')
    .eq('site_id', forumId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!mem) return false;
  return !mem.expires_at || mem.expires_at > new Date().toISOString();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; threadId: string }> }
) {
  try {
    const { slug, threadId } = await context.params;

    const { data: forum } = await supabaseAdmin
      .from('forums')
      .select('id, slug, name, description, owner_id, is_public, accent_color, plan_tier')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!forum) {
      return NextResponse.json({ error: 'Forum not found' }, { status: 404 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!forum.is_public) {
      if (!user) {
        return NextResponse.json({ error: 'This forum is private.' }, { status: 403 });
      }
      if (forum.owner_id !== user.id) {
        const { data: member } = await supabaseAdmin
          .from('forum_members')
          .select('role')
          .eq('forum_id', forum.id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!member) {
          return NextResponse.json({ error: 'This forum is private.' }, { status: 403 });
        }
      }
    }

    const { data: thread } = await supabaseAdmin
      .from('forum_threads')
      .select('id, forum_id, author_id, title, body, is_pinned, is_locked, reply_count, last_activity_at, created_at')
      .eq('id', threadId)
      .eq('forum_id', forum.id)
      .maybeSingle();

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const { data: gatedCol } = await supabaseAdmin
      .from('forum_threads')
      .select('is_members_only')
      .eq('id', thread.id)
      .maybeSingle();
    const isMembersOnly = gatedCol?.is_members_only === true;
    if (isMembersOnly && !(await hasPaidMemberAccess(forum.id, forum.owner_id, forum.plan_tier, user?.id, user?.email))) {
      return NextResponse.json({ error: 'This discussion is for active members only.', members_only: true }, { status: 403 });
    }

    const { data: posts, error: postsErr } = await supabaseAdmin
      .from('forum_posts')
      .select('id, thread_id, forum_id, author_id, body, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .limit(200);

    if (postsErr) throw postsErr;

    const allIds = [thread.author_id, ...(posts || []).map((p) => p.author_id)];
    const names = await resolveAuthorNames(allIds);

    return NextResponse.json({
      forum,
      thread: { ...thread, author_name: names.get(thread.author_id) || 'Member' },
      posts: (posts || []).map((p) => ({
        ...p,
        author_name: names.get(p.author_id) || 'Member',
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load thread';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; threadId: string }> }
) {
  try {
    const { slug, threadId } = await context.params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to reply.' }, { status: 401 });
    }

    const { data: forum } = await supabaseAdmin
      .from('forums')
      .select('id, owner_id, is_public, plan_tier')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!forum) {
      return NextResponse.json({ error: 'Forum not found' }, { status: 404 });
    }

    if (!forum.is_public && forum.owner_id !== user.id) {
      const { data: member } = await supabaseAdmin
        .from('forum_members')
        .select('role')
        .eq('forum_id', forum.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!member) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { data: thread } = await supabaseAdmin
      .from('forum_threads')
      .select('id, is_locked')
      .eq('id', threadId)
      .eq('forum_id', forum.id)
      .maybeSingle();

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const { data: gatedCol } = await supabaseAdmin
      .from('forum_threads')
      .select('is_members_only')
      .eq('id', thread.id)
      .maybeSingle();
    const isMembersOnly = gatedCol?.is_members_only === true;
    if (isMembersOnly && !(await hasPaidMemberAccess(forum.id, forum.owner_id, forum.plan_tier, user?.id, user?.email))) {
      return NextResponse.json({ error: 'This discussion is for active members only.', members_only: true }, { status: 403 });
    }
    if (thread.is_locked) {
      return NextResponse.json({ error: 'This thread is locked.' }, { status: 403 });
    }

    const raw = await request.json();
    const parsed = replySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid reply' }, { status: 400 });
    }

    const { data: post, error } = await supabaseAdmin
      .from('forum_posts')
      .insert({
        thread_id: thread.id,
        forum_id: forum.id,
        author_id: user.id,
        body: xss(parsed.data.body),
      })
      .select('id, thread_id, forum_id, author_id, body, created_at')
      .single();

    if (error || !post) throw error || new Error('Failed to post reply');

    await supabaseAdmin
      .from('forum_members')
      .upsert({ forum_id: forum.id, user_id: user.id, role: forum.owner_id === user.id ? 'owner' : 'member' }, { onConflict: 'forum_id,user_id', ignoreDuplicates: true });

    const names = await resolveAuthorNames([user.id]);
    return NextResponse.json(
      { post: { ...post, author_name: names.get(user.id) || 'Member' } },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to post reply';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Owner moderation: pin/unpin or lock/unlock a thread. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; threadId: string }> }
) {
  const { slug, threadId } = await context.params;
  const { requireOwnedSite } = await import('@/lib/forumServer');
  const r = await requireOwnedSite(slug, ['owner', 'manager', 'support']);
  if ('error' in r) return r.error;
  const body = await request.json().catch(() => null);
  const updates: Record<string, boolean> = {};
  if (typeof body?.is_pinned === 'boolean') updates.is_pinned = body.is_pinned;
  if (typeof body?.is_locked === 'boolean') updates.is_locked = body.is_locked;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('forum_threads').update(updates).eq('id', threadId).eq('forum_id', r.site.id);
  if (error) return NextResponse.json({ error: 'Could not update the thread.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Owner moderation: delete a thread and its replies. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string; threadId: string }> }
) {
  const { slug, threadId } = await context.params;
  const { requireOwnedSite } = await import('@/lib/forumServer');
  const r = await requireOwnedSite(slug, ['owner', 'manager', 'support']);
  if ('error' in r) return r.error;
  await supabaseAdmin.from('forum_posts').delete().eq('thread_id', threadId).eq('forum_id', r.site.id);
  await supabaseAdmin.from('forum_threads').delete().eq('id', threadId).eq('forum_id', r.site.id);
  const { count } = await supabaseAdmin.from('forum_threads').select('id', { count: 'exact', head: true }).eq('forum_id', r.site.id);
  await supabaseAdmin.from('forums').update({ thread_count: count ?? 0 }).eq('id', r.site.id);
  return NextResponse.json({ ok: true });
}
