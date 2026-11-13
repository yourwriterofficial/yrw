import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveAuthorNames, supabaseAdmin } from '@/lib/forumServer';

const createThreadSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
  body: z.string().trim().min(5, 'Post body must be at least 5 characters').max(8000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to start a discussion.' }, { status: 401 });
    }

    const { data: forum } = await supabaseAdmin
      .from('forums')
      .select('id, owner_id, is_public')
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
        return NextResponse.json({ error: 'Join this private forum to post.' }, { status: 403 });
      }
    }

    const raw = await request.json();
    const parsed = createThreadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid thread input' }, { status: 400 });
    }

    const { data: thread, error } = await supabaseAdmin
      .from('forum_threads')
      .insert({
        forum_id: forum.id,
        author_id: user.id,
        title: xss(parsed.data.title),
        body: xss(parsed.data.body),
      })
      .select('id, forum_id, author_id, title, body, is_pinned, is_locked, reply_count, last_activity_at, created_at')
      .single();

    if (error || !thread) throw error || new Error('Failed to create thread');

    // Auto-join public forum when posting first thread
    await supabaseAdmin
      .from('forum_members')
      .upsert({ forum_id: forum.id, user_id: user.id, role: forum.owner_id === user.id ? 'owner' : 'member' }, { onConflict: 'forum_id,user_id', ignoreDuplicates: true });

    const names = await resolveAuthorNames([user.id]);
    return NextResponse.json(
      { thread: { ...thread, author_name: names.get(user.id) || 'Member' } },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create thread';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
