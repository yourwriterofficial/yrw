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
  console.log('Syncing all topics with level_prices and level_page_counts settings...');

  const levelPrices = { BSc: 5999, MSc: 10999, PhD: 15999 };
  const levelPageCounts = { BSc: 50, MSc: 50, PhD: 50 };

  for (const [lvl, price] of Object.entries(levelPrices)) {
    console.log(`Syncing price for ${lvl} -> ₦${price}...`);
    const start = Date.now();
    const { error } = await supabase
      .from('project_topics')
      .update({ price: Number(price), updated_at: new Date().toISOString() })
      .eq('level', lvl);
    
    if (error) console.error(`Error updating price for ${lvl}:`, error);
    else console.log(`Finished price sync for ${lvl} in`, (Date.now() - start) / 1000, 'seconds');
  }

  for (const [lvl, pages] of Object.entries(levelPageCounts)) {
    console.log(`Syncing pages for ${lvl} -> ${pages} pages...`);
    const start = Date.now();
    const { error } = await supabase
      .from('project_topics')
      .update({ pages: Number(pages), updated_at: new Date().toISOString() })
      .eq('level', lvl);
    
    if (error) console.error(`Error updating pages for ${lvl}:`, error);
    else console.log(`Finished pages sync for ${lvl} in`, (Date.now() - start) / 1000, 'seconds');
  }

  console.log('Sync complete!');
}

run();
