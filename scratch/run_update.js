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
  console.log('Starting bulk update test...');
  
  const start = Date.now();
  
  // Update BSc prices to 5999
  const { data, error, count } = await supabase
    .from('project_topics')
    .update({ price: 5999, updated_at: new Date().toISOString() })
    .eq('level', 'BSc');
    
  console.log('Update finished in', (Date.now() - start) / 1000, 'seconds');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Count:', count);
  }
}

run();
