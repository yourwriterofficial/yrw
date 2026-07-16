import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: settings, error: sErr } = await supabase.from('project_settings').select('*');
  console.log('--- Settings ---');
  if (sErr) console.error(sErr);
  else console.log(JSON.stringify(settings, null, 2));

  const { count, error: tErr } = await supabase.from('project_topics').select('*', { count: 'exact', head: true });
  console.log('--- Topics Count ---');
  if (tErr) console.error(tErr);
  else console.log('Total active/inactive topics:', count);

  const { data: sample, error: pErr } = await supabase.from('project_topics').select('id, title, price, level, pages').limit(5);
  console.log('--- Sample Topics ---');
  if (pErr) console.error(pErr);
  else console.log(JSON.stringify(sample, null, 2));
}

run();
