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
const anonKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  try {
    const rawData = atob(base64);
    return Uint8Array.from(Array.from(rawData).map(c => c.charCodeAt(0)));
  } catch (e) {
    console.error('atob failed for:', base64, e.message);
    throw e;
  }
}

async function testFetch() {
  const url = `${supabaseUrl}/functions/v1/vapid-key`;
  console.log('Fetching VAPID key from:', url);
  try {
    const res = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    });
    console.log('Status:', res.status);
    const { publicKey } = await res.json();
    console.log('PublicKey string:', publicKey);
    console.log('Length:', publicKey.length);
    const bytes = urlBase64ToUint8Array(publicKey);
    console.log('Decoded byte length:', bytes.length);
    console.log('First byte (should be 4/0x04):', bytes[0]);
  } catch (err) {
    console.error('Error fetching VAPID key:', err);
  }
}

testFetch();
