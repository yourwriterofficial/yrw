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

## Payments and plans
- **Paystack is live in production.** `PAYSTACK_SECRET_KEY` (a live key) is set in Vercel and `PAYSTACK_FORCE_TEST` is removed.
  Localhost keeps test mode through `.env.local`. If Paystack answers "Invalid key", the key was rolled in the dashboard:
  copy the current live secret key, update `PAYSTACK_SECRET_KEY` in Vercel (production, sensitive) and redeploy.
- Shoppers pay online by default. **Bank transfer and pay on delivery are Pro features** (Pro, Business, Corporate).
  Plan flags: `bankTransfer` and `payOnDelivery` in `lib/plans.ts`; the order API refuses a method the plan lacks. A store
  with no online payments on Free or Lite shows an "Order on WhatsApp" button instead.
- A bank connected in live mode creates a live Paystack subaccount; test-mode subaccounts do not work live.
- **No Paystack webhook is needed for Developa.** Paid orders are confirmed when the shopper returns from Paystack (`/api/developa/pay/return`),
  and the 10-minute reconcile timer re-checks any checkout that was not confirmed. `/api/paystack/webhook` is intentionally switched off, so leave
  the Paystack dashboard webhook field as it is.
- Plans are priced per month in `lib/plans.ts`; 6-month and 1-year periods are discounted (`BILLING_PERIODS`).

## Home page, guided setup and themes
- The Developa home page (`app/create/CreatePortalView.tsx`, motion in `HomeMotion.tsx`) uses its own violet-to-pink palette (`.dv-theme`).
- New sites are made through the guided setup (`app/create/GuidedSetup.tsx`): goal, matching themes, feature switches, then name and launch.
  The owner's choices (payments or WhatsApp ordering, phone alerts, install as app, chat, business card) are saved as plugin switches right after the site is created.
- Themes retired from the picker are listed in `RETIRED_TEMPLATE_IDS` (`lib/siteTemplates.ts`). Sites already using them keep working.
- The Developa D logo and icons live in `public/developa/` (favicon, install icons, notification badge, manifest) and `app/components/DevelopaMark.tsx`.
  Phone notifications on developa hosts use the D (`public/sw.js`, `public/site-sw.js`); bump `ICON_VERSION` in `sw.js` after changing the icon files.

## Store owner support
Every store dashboard has a **Support** tab: a chat with the Developa team on all plans. A message becomes (or is added to) a thread in the
Developa support inbox (`/admin/inbox`, address `support@developa.me`), titled "Support: <store> (<slug>)" with the store and plan
at the bottom. Business and Corporate stores are marked high priority. Reply from the inbox as usual: the owner gets the reply by
email and sees it in their Support tab, and their email reply lands back in the same thread. API: `app/api/forums/[slug]/support-chat/route.ts`.

## Store page speed
The store page (`app/forums/[slug]/page.tsx`) is built once per store and kept for 30 seconds on Vercel's edge, because its HTML is the same
for every visitor (store content and personal details load in the browser through separate requests). A visit now takes about as long as the
network allows instead of waiting for the server. Edits show up within about 30 seconds (the dashboard and the store's data are not delayed).
Checked on the live site: a store address and the home page, both requested as `developa.me/` by the Worker, are cached separately, and
unknown store names get their own 404. If a store ever shows another store's page, remove `revalidate` and `generateStaticParams` from that file.
