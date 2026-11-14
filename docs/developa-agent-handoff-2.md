# Agent hand-off 2: what to do after commit baddf94

Read `docs/developa-agent-todo.md` first for the code rules and the review checklist. Work on a branch, make small commits with clear messages, and stop when each package is done so it can be reviewed and tested by the reviewer. Never print or commit secrets. Run `npx tsc --noEmit` and `npx eslint` on every file you touch and report the real results, including anything you could not check.

## A. Database (do first, nothing below works without it)

1. Apply `supabase/migrations/20261114060000_themes_plugins_push.sql` to the live project with the Supabase connection. It is safe to re-run. It adds: `theme_catalog`, `theme_purchases`, `forums.plugins`, `site_push_subscriptions`, `forums.prune_warned_at`, `forums.prune_final_warned_at`, `site_ad_slots`, `site_ad_bookings`, `site_messages`.
2. Confirm with read-only queries that every table and column exists, that row level security is on for each new table, and that `theme_purchases` has only the "own rows" read policy.
3. Check that deleting a `forums` row cascades to products, orders, threads, members, coupons, ad slots, bookings, messages and push subscriptions (the clean-up job relies on it). List any table that would be left behind.
4. Report anything that failed. Do not edit the migration without telling the reviewer.

## B. Testing is done by the reviewer, not by you

The reviewer (Claude) runs the acceptance tests on the throwaway test site: plan limits and billing periods, themes and premium gating, forum layouts, ad space, chat, plugin switches, the PWA and phone alerts, the clean-up job and email. You do not run these.

What you do for testing: after applying the migration in section A, tell the reviewer exactly what was applied and what you verified, so testing can start. Fix any defect the reviewer reports, add a test-friendly way to reproduce it if needed, and write nothing into the review log for tests you did not run yourself.

## C. Fix and harden

1. The push route lets a staff member who was removed from a site keep their order alerts. When staff access changes or is removed, delete that person's `site_push_subscriptions` rows for the site.
2. Add de-duplication to site push: the same title and body to the same endpoint within 10 minutes is sent once (ProsePen does this in `notifications.ts`).
3. Add a buyer opt-in button for order alerts on the order tracking screen (the API already accepts the buyer audience) and a way for a buyer to turn alerts off.
4. Chat: add an unread badge on the Messages tab and a push alert to the owner for a new message (reuse `sendSitePush`, with the `after()` pattern used for orders).
5. Chat and ad space abuse limits: cap message length is done; add a per-site daily cap on new conversations and block a buyer from the owner's side if needed.
6. Theme purchase requests: let a buyer see their pending request and reference again after refreshing (the picker only shows "Waiting for confirmation"). Show it in the Plan or a new "Themes" area of the account.
7. Site deletion by the clean-up job should also remove the site's files if any are stored in Drive references, and should write a row to an audit log (site name, slug, owner id, time) so a deleted site can be investigated.
8. Check that the forum `ThreadListThemes` and the preview page are readable in dark mode and at 320px, and that none of the new components use colour classes that only suit a dark background.
9. Review every new API route for: sign-in checks, plan checks on the server, owner-only versus staff rules, rate limits, input limits, and no raw error text returned to visitors.
10. Fix the pre-existing lint errors in files you touch; do not mass-edit untouched files.

## D. New features to build (in this order, one package each)

1. **Theme previews with the owner's own name and colours**: a "Try with my name" field on the preview page (no saving).
2. **Setup wizard for first-time owners** (no HTML knowledge needed): after the site is created, a 5-step guided flow in Admin (logo, three products or posts, bank details and WhatsApp, a share link with QR, install the app), each step with one screen, plain words, and a progress bar. Reuse the existing Getting started checklist data.
3. **Referral program for site owners** (from Subskription's affiliate system and `apply-referral` here): each site owner gets a link; when someone they refer pays for a plan, the owner earns a credit or free months. Founder sets the reward in Admin. Needs a migration (referrals table); write it as a new migration file and do not edit the earlier ones.
4. **Invoices owners can send to their own customers** with a payment link and printable page (reuse the invoice code from the main site).
5. **Paystack checkout for plans, themes and ad bookings** following the ProsePen pattern: pending row before checkout, confirm the charge server to server when the buyer returns, claim the row once, a reconcile step in the daily job for payments that never returned, and no dependence on a webhook. Delivery must be automatic: the same code the founder's "money received" button runs. Keep manual bank transfer as a fallback. Do not start this package until the founder confirms which Paystack account and keys to use.
6. **Newsletter plugin** (Pro: 1,000 a month, Business: 5,000) using the Apps Script mailer with a daily quota guard and the normal email service as fallback.
7. **Writing helpers for blog themes** (proofread and readability) only if the founder decides to price it separately.

## E. Hosting readiness (hobby tiers)

1. Measure and report the number of database queries a public store page and a public forum page make; cut any that can be cached with `s-maxage` or combined.
2. Confirm every cron stays daily and finishes inside 60 seconds with 200 sites; page the clean-up job (it already limits to 200 per run).
3. Confirm no feature relies on a long-running connection, and that chat and push polling stop when the tab is hidden.
4. List the Supabase Free and Vercel Hobby limits that the app is closest to, with the numbers, in `docs/developa-plugin-decisions.md`.

## F. Founder items the agent cannot do (remind the founder)

- Set `CRON_SECRET`, `VAPID_PRIVATE_KEY` (the private key that matches the public key in use), `VAPID_SUBJECT`, `GOOGLE_APPS_SCRIPT_MAIL_URL`, `MAIL_SECRET` on the host.
- Deploy `scripts/google-apps-script-mailer.gs` and change `SHARED_SECRET` in it; rotate the public default `SHARED_SECRET` in the Drive uploader script as well.
- Decide the Paystack account and keys, and approve moving off Vercel Hobby and Supabase Free before taking real money.
- Push to GitHub when ready (nothing has been pushed).

## Definition of done for each package

- Migration (if any) as a new file, applied and verified.
- Code type-checks and lints clean for touched files.
- Handed to the reviewer for testing (you only check that it compiles and that your own change works).
- Review log entry added to `docs/developa-agent-todo.md`.
- Small commits, no unrelated files, no secrets.
