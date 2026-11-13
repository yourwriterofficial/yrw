import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/forumServer';

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to join this forum.' }, { status: 401 });
    }

    const { data: forum } = await supabaseAdmin
      .from('forums')
      .select('id, owner_id, is_public')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!forum) {
      return NextResponse.json({ error: 'Forum not found' }, { status: 404 });
    }
    if (forum.owner_id === user.id) {
      return NextResponse.json({ joined: true, message: 'You own this forum.' });
    }
    if (!forum.is_public) {
      return NextResponse.json({ error: 'Private forums require an invite.' }, { status: 403 });
    }

    const { data: existing } = await supabaseAdmin
      .from('forum_members')
      .select('role')
      .eq('forum_id', forum.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('forum_members')
        .delete()
        .eq('forum_id', forum.id)
        .eq('user_id', user.id);
      return NextResponse.json({ joined: false });
    }

    await supabaseAdmin
      .from('forum_members')
      .insert({ forum_id: forum.id, user_id: user.id, role: 'member' });

    return NextResponse.json({ joined: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update membership';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
