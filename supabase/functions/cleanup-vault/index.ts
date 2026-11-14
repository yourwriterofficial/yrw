// supabase/functions/cleanup-vault/index.ts
import { createClient } from '@supabase/supabase-js'
import { getSupabaseSecretKey } from '../_shared/keys.ts'

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, getSupabaseSecretKey())
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: oldFiles } = await supabase.storage.from('final-deliverables').list('', { 
    search: '', 
    sortBy: { column: 'created_at', order: 'asc' } 
  })
  for (const file of oldFiles) {
    if (new Date(file.created_at) < threeDaysAgo) {
      await supabase.storage.from('final-deliverables').remove([file.name])
    }
  }
  return new Response('OK')
})