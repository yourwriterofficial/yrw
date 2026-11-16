# Developa: running it after launch

## Timers (free)
Vercel Hobby only allows daily cron jobs, so two things that need to run often are driven by the free Cloudflare Worker
`developa-stores` (code in `cloudflare-worker/developa-stores.js`):

| Every 10 minutes | Does |
| --- | --- |
| `POST /api/developa/announcements/run` | sends announcements that were scheduled for later |
| `POST /api/developa/reconcile` | re-checks Paystack checkouts from the last 48 hours whose webhook never arrived |

Both need `Authorization: Bearer <CRON_SECRET>`. `CRON_SECRET` is set in Vercel (production) and as a Worker secret.
The daily Vercel crons (`/api/cron/developa-daily`, `/api/cron/prune-vault`) use the same value automatically.

## Error alerts (free)
`instrumentation.ts` calls `lib/errorAlert.ts` for every unexpected server error. It emails `ERROR_ALERT_TO`
(default `support@developa.me`, which lands in the admin support inbox). One email per problem every 20 minutes, at most
6 an hour per server. Only the message, page address and method are sent. Full detail is in the Vercel logs.

## Push alerts
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are set in Vercel production. Changing the key
pair invalidates every existing phone subscription, so do not rotate it casually.

## Backups (free, no card)
Every night at 02:00 UTC the Cloudflare timer calls `POST /api/developa/backup`. The app exports ONLY (1) paid Developa stores with all their data (products, orders, customers, coupons, bookings,
memberships, messages, posts, staff, plan payments) and their owners' accounts, and (2) Developa admin settings (bans and
limits, announcements, platform ads, theme prices and sales, Script Shop, developer page text, admin history, support inbox
mailboxes and saved replies). Free stores, project topics, wallets, quotes and all YourResearchWriter data are left out.
It never includes password hashes. The data is compressed, **encrypts it with AES-256-GCM** using
`BACKUP_PASSPHRASE`, and sends the scrambled file to the Google Apps Script web app
"Developa Backup Receiver" (source: `scripts/google-apps-script-backup-receiver.gs`). That script saves it in the
private Drive folder **Developa Backups (private)** and moves anything older than 14 days to the Drive trash. A run
on the same day replaces that day's file. If a backup fails, an email goes to `ERROR_ALERT_TO`.

- Settings: `DRIVE_BACKUP_URL`, `DRIVE_BACKUP_SECRET` (same value as SHARED_SECRET in the Apps Script) and
  `BACKUP_PASSPHRASE` in Vercel production. The passphrase is also saved in
  `Documents/network-secrets/developa-backup-passphrase.txt` on the owner's computer. **Copy it to a password manager:
  without it a backup cannot be opened.**
- File name: `YYYY-MM-DD_developa-paid-stores-and-settings.dvbk`.
- Not included: images and files in storage buckets.
- Open a backup: download the `.dvbk` file from Drive, then
  `BACKUP_PASSPHRASE="..." node scripts/restore-backup.mjs 2026-11-16_developa-main.dvbk > backup.json`.
  The result is JSON of every table. Re-insert rows with the Supabase service key or the SQL editor.
- Test a restore once a month.
- Store backups for site owners (weekly email and download) are a Corporate-plan feature and are separate from this.
