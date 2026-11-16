#!/usr/bin/env node
/**
 * Opens a Developa backup file (.dvbk) that was saved in Google Drive.
 *
 *   BACKUP_PASSPHRASE="..." node scripts/restore-backup.mjs 2026-11-16_developa-main.dvbk > backup.json
 *
 * The output is plain JSON: { "table_name": [rows...], "_accounts": [...] }. Keep it private. To restore a table,
 * insert its rows back with the Supabase service key (or the SQL editor), oldest data first.
 */
import { readFileSync } from 'fs';
import { createDecipheriv, scryptSync } from 'crypto';
import { gunzipSync } from 'zlib';

const file = process.argv[2];
const pass = process.env.BACKUP_PASSPHRASE;
if (!file || !pass) {
  console.error('Usage: BACKUP_PASSPHRASE="..." node scripts/restore-backup.mjs <file.dvbk> > backup.json');
  process.exit(1);
}
const buf = readFileSync(file);
if (buf.subarray(0, 5).toString() !== 'DVBK1') {
  console.error('This is not a Developa backup file.');
  process.exit(1);
}
const salt = buf.subarray(5, 21);
const iv = buf.subarray(21, 33);
const tag = buf.subarray(33, 49);
const ct = buf.subarray(49);
try {
  const decipher = createDecipheriv('aes-256-gcm', scryptSync(pass, salt, 32), iv);
  decipher.setAuthTag(tag);
  process.stdout.write(gunzipSync(Buffer.concat([decipher.update(ct), decipher.final()])));
} catch {
  console.error('Could not open the file: wrong passphrase, or the file is damaged.');
  process.exit(2);
}
