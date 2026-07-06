const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env.local');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
const envConfig = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    envConfig[key] = val;
  }
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function testPush() {
  console.log('Fetching push subscriptions...');
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .limit(5);

  if (error) {
    console.error('Error fetching subscriptions:', error.message);
    return;
  }

  if (!subs || subs.length === 0) {
    console.log('No push subscriptions found in database. Please register a device first on the frontend.');
    return;
  }

  console.log(`Found ${subs.length} subscription(s). Sending test push to user: ${subs[0].user_id}`);

  const payload = {
    user_ids: [subs[0].user_id],
    title: 'Test Notification ⚡',
    body: 'This is a test push notification from Antigravity!',
    url: '/dashboard/client',
    tag: 'test-push',
    notification_type: 'admin_message'
  };

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey
      },
      body: JSON.stringify(payload)
    });

    console.log('Send-push response status:', res.status);
    const text = await res.text();
    console.log('Send-push response body:', text);
  } catch (err) {
    console.error('Failed to trigger send-push edge function:', err);
  }
}

testPush();
