import { createClient } from '@supabase/supabase-js';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

  // Get deliverables that were downloaded more than 4 days ago
  const { data: toDelete, error } = await supabase
    .from('final_deliverables')
    .select('id, file_path')
    .lt('downloaded_at', fourDaysAgo)
    .not('downloaded_at', 'is', null); // only those with a download timestamp

  if (error) {
    console.error('Error fetching expired deliverables:', error);
    return new Response('Error', { status: 500 });
  }

  let deletedCount = 0;
  for (const item of toDelete) {
    // Delete from storage
    await supabase.storage.from('final-deliverables').remove([item.file_path]);
    // Delete record
    await supabase.from('final_deliverables').delete().eq('id', item.id);
    deletedCount++;
  }

  return new Response(`Pruned ${deletedCount} files.`, { status: 200 });
});