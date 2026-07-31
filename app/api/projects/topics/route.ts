import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAGE_SIZE = 30;

/**
 * Public catalogue listing for /projects. Goes through the service-role key
 * instead of the browser's anon Supabase client because project_topics' RLS
 * only grants SELECT to the authenticated role — anonymous visitors (the
 * majority of traffic on this public page) got a silent empty result with no
 * error. This is read-only, non-sensitive catalogue data, so bypassing RLS
 * here is safe.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const dept = searchParams.get('dept') || 'all';
    const level = searchParams.get('level') || 'all';
    const search = (searchParams.get('search') || '').trim();
    const useRandom = searchParams.get('random') === 'true';
    const seed = Number(searchParams.get('seed')) || 0;

    const from = (page - 1) * PAGE_SIZE;

    let countQuery = admin.from('project_topics').select('*', { count: 'exact', head: true }).eq('is_active', true);
    if (dept !== 'all') countQuery = countQuery.eq('department', dept);
    if (level !== 'all') countQuery = countQuery.eq('level', level);
    if (search) countQuery = countQuery.ilike('title', `%${search}%`);
    const { count } = await countQuery;

    let data: any[] | null = null;

    if (useRandom) {
      const { data: rpcData, error: rpcError } = await admin.rpc('get_project_topics_random', {
        p_seed: seed,
        p_dept: dept,
        p_level: level,
        p_search: search,
        p_limit: PAGE_SIZE,
        p_offset: from,
      });
      if (!rpcError) data = rpcData;
    }

    if (!data) {
      let q = admin.from('project_topics').select('*').eq('is_active', true);
      if (dept !== 'all') q = q.eq('department', dept);
      if (level !== 'all') q = q.eq('level', level);
      if (search) q = q.ilike('title', `%${search}%`);
      q = q.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
      const { data: selectData, error: selectError } = await q;
      if (selectError) throw selectError;
      data = selectData;
    }

    return NextResponse.json({ topics: data || [], total: count || 0 });
  } catch (err: any) {
    console.error('GET /api/projects/topics failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to load topics' }, { status: 500 });
  }
}
