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

## Backups (Supabase free has none you can download)
The GitHub repository is public, so database dumps must never be stored as GitHub artifacts. Recommended free setup:

1. Create a **private** Cloudflare R2 bucket (free tier: 10 GB, no download fees).
2. A nightly job (GitHub Actions in a *private* backup repository, or a local scheduled task) exports every table with
   the Supabase service key, compresses it, encrypts it with a passphrase kept in your password manager, and uploads it to R2.
3. Keep 14 daily copies and 8 weekly copies. Test a restore once a month.
4. Until that is running, take a manual export from the Supabase dashboard (Database, Backups is Pro-only, so use
   Table editor export or `pg_dump` with the connection string) before any risky change.
