import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();

const supabase = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

async function run() {
  const { count, error: cErr } = await supabase.from('project_topics').select('*', { count: 'exact', head: true });
  if (cErr) return console.error(cErr);
  console.log('Total project_topics rows:', count);

  const { data, error } = await supabase.from('project_topics').select('department');
  if (error) return console.error(error);
  const tally = {};
  for (const row of data) tally[row.department] = (tally[row.department] || 0) + 1;
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  console.log('Distinct departments in DB:', sorted.length);
  for (const [d, n] of sorted) console.log(n, d);
}

run();
