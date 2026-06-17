import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge'; // optional for Vercel Edge

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

  const { data: toDelete, error } = await supabase
    .from('final_deliverables')
    .select('id, file_path')
    .lt('downloaded_at', fourDaysAgo)
    .not('downloaded_at', 'is', null);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let deletedCount = 0;
  for (const item of toDelete) {
    await supabase.storage.from('final-deliverables').remove([item.file_path]);
    await supabase.from('final_deliverables').delete().eq('id', item.id);
    deletedCount++;
  }

  return NextResponse.json({ message: `Pruned ${deletedCount} files.` });
}