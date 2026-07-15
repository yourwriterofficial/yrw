import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('project_addons')
    .select('*')
    .order('sort_order');
  
  if (error) {
    console.error('Error fetching addons:', error);
  } else {
    console.log('Current Addons:', JSON.stringify(data, null, 2));
  }
}

run();
