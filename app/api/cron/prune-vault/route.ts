import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // Optional: Add a secret check to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

    // Find files downloaded more than 4 days ago
    const { data: toDelete, error } = await supabase
      .from('final_deliverables')
      .select('id, file_path')
      .lt('downloaded_at', fourDaysAgo)
      .not('downloaded_at', 'is', null);

    if (error) {
      console.error('Prune error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let deletedCount = 0;
    for (const item of toDelete) {
      // Delete from storage
      await supabase.storage.from('final-deliverables').remove([item.file_path]);
      // Delete record
      await supabase.from('final_deliverables').delete().eq('id', item.id);
      deletedCount++;
    }

    return NextResponse.json({ 
      message: `Pruned ${deletedCount} files.`,
      deleted: deletedCount 
    });
  } catch (err: any) {
    console.error('Cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}