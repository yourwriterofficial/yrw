# developa.me: implementation to-do for the building agent

Written 2026-11-14 by the reviewing engineer. You (the building agent) implement; the reviewer checks every
package before the next one starts. The founder approved all 60 features in
`docs/developa-feature-roadmap.md`; this file turns what is left into work packages.

Repo: `C:\Users\chati\Documents\research-writer` (`main`). There is **one** copy of the project; do not create
or edit any other copy. Supabase project ref: `jaqkqlitaqxjbkxfcvjs`.

---

## 0. Rules for every package

**Process**
1. One package at a time, in the order below. Do not start the next until the reviewer says the last one is accepted.
2. Work on a branch `feat/<package-id>` (for example `feat/2-3-variants`). Small commits. Do not push, and do not merge to `main`; the reviewer merges.
3. When a package is done, post a hand-off note: files changed, the migration file name (if any), what you tested and how, anything you were unsure about.
4. Never commit secrets. Names of env variables go in `.env.example`; values stay in `.env.local`.

**Code conventions (all already used in the repo, follow them)**
- Next.js 16 app router, TypeScript, Supabase, Tailwind. `npx tsc --noEmit` must pass with **no new errors** before you hand off.
- **Plan rules live only in `lib/plans.ts`.** To add a gated feature, add a flag to `PlanDefinition` and every tier there, then check it with `planFor(site.plan_tier, site.plan_expires_at)` on the **server**. Hiding a button in the UI is never enough: the API must refuse too.
- **Ownership:** every owner-only endpoint starts with `requireOwnedSite(slug)` from `lib/forumServer.ts`. Platform-admin endpoints use `isPlatformAdmin()`.
- **Migrations:** new file in `supabase/migrations/`, timestamp later than `20261114020000`, idempotent (`if not exists`), RLS enabled on every new table, no policies that expose other owners' rows. Reads of new columns/tables must be **tolerant** (see `readExtendedSite` / `readSeo`): the page must still work if the migration has not been applied yet. After applying a migration, say so in the hand-off.
- **Public endpoints** (anything a buyer or visitor can call) need `overLimit()` from `lib/rateLimit.ts`, input validation with zod, and must never return owner-only fields (bank details beyond what checkout needs, `digital_url`, other buyers' data).
- **Prices and amounts are computed on the server.** Never trust a total, discount or shipping fee sent by the browser.
- **Money and stock changes are atomic:** use the conditional-update pattern in `adjustStock`; never read-then-write without a guard.
- Emails to buyers go through `lib/storeEmails.ts`; they are best effort and must never block the request.
- UI uses the shared design system in `app/globals.css` (`g-wrap`, `g-card`, `g-tonal`, `input-box`, pill buttons, fluid type). Plain wording, no all-caps labels, no AI-style icons. Check at 375px wide: no sideways scroll, tap targets at least 40px.
- Escape every owner- or buyer-supplied string before putting it in HTML or email (`esc()` in `lib/storeEmails.ts`, `xss()` on stored text).

**Definition of done for a package**
- Works end to end as the three roles that matter: **buyer/visitor**, **site owner**, **founder** (where relevant).
- Server enforces the plan tier and ownership.
- Works before and after its migration is applied.
- Typecheck passes; mobile (375px) checked; empty, error and loading states handled.
- `docs/developa-feature-roadmap.md` Status column updated; `README`/docs updated if behaviour changed.

---

## 1. Housekeeping first (blockers)

| ID | Task | Owner |
|---|---|---|
| 1.1 | Apply `supabase/migrations/20261114020000_site_seo.sql` (Google title/description). Until then the Settings save returns "needs the latest database update". | founder / agent with DB access |
| 1.2 | Founder: replace `SHARED_SECRET` in the Google Apps Script with a long random string and set the same value as `DRIVE_UPLOAD_SECRET` in `.env.local`; redeploy the script. The old default is public. | founder |
| 1.3 | Delete the dead Paystack leftover `app/payment/callback/` (it spins forever when opened directly) and any references to it. | agent |
| 1.4 | Decide the payments route (section 3) before starting packages 3.x. | founder |
| 1.5 | Add `docs/` link to the three docs in the repo README so the next agent finds them. | agent |

---

## 2. Storefront and owner features (no payment provider needed)

Do these in order. Each lists plan tier, data, API, UI and the acceptance test.

### 2.1 WhatsApp button on every product and a product share link (free)
- **Data:** none. Use the store's `whatsapp_number` (convert with `waNumber()` in `lib/phone.ts`).
- **UI:** product card and a new product detail view/modal show "Ask on WhatsApp" (message: store name, product name, price, product link). Add a "Share" button that copies a link like `/forums/<slug>?product=<id>` and opens that product.
- **Accept:** a number typed as `0803…` opens a valid `wa.me/234803…` chat with the product in the message; the share link opens the product directly; no button shown if the store has no number.

### 2.2 Several photos per product (Pro)
- **Data:** `site_products.image_urls text[] default '{}'` (keep `image_url` as the first photo for backwards compatibility).
- **API:** products POST/PATCH accept up to 6 URLs (https only). Free plan: 1 photo (server-enforced). Photos upload through `/api/upload/drive`.
- **UI:** Manage → Products: add/remove/reorder photos. Storefront: swipeable gallery on the product view with thumbnails.
- **Accept:** Free owner cannot save a second photo (clear message pointing to Pro); Pro owner can; old products with only `image_url` still render.

### 2.3 Product variants (Pro)
- **Data:** `site_product_variants(id, product_id, label, price_delta or price, stock_qty, sku, sort_order)`, RLS on. Option names stored per product (for example `Size`, `Colour`).
- **API:** CRUD under `/api/forums/[slug]/products/[productId]/variants` (owner). Orders accept `variant_id` per item; the **server** takes the variant's price and stock; `adjustStock` must work per variant (generalise it, do not copy it).
- **UI:** owner form to add options and combinations; storefront shows pickers, updates price and "sold out" per combination; cart/order/email show the chosen variant.
- **Accept:** two buyers cannot take the last "Black / L"; changing a variant price in the browser changes nothing server side; cancel/reject returns the variant's stock.

### 2.4 Order tracking page for buyers (free)
- **API:** the lookup (`GET /api/forums/[slug]/orders?code=&email=`) exists and is rate limited. Do not weaken it.
- **UI:** "Track your order" page/section on every store: enter code and email, see payment and delivery status in plain words and the digital downloads once paid. Link to it from every buyer email.
- **Accept:** wrong email returns the same "not found" as a wrong code; downloads appear only when `payment_status = paid`.

### 2.5 Reviews and ratings (Pro)
- **Data:** `site_reviews(id, site_id, product_id, order_id, buyer_name, rating 1..5, body, is_visible, created_at)`; one review per order item.
- **API:** a buyer may review only a product from a **paid** order, proved by order code + email. Owner can hide a review. Public GET returns visible reviews and the average.
- **UI:** stars on cards, reviews on the product view, "Leave a review" from the tracking page and from a follow-up email 3 days after "completed".
- **Accept:** cannot review without a paid order; HTML in a review is escaped; average updates.

### 2.6 About, Contact, Delivery and Returns pages (free)
- **Data:** `forums.page_about`, `page_delivery`, `page_returns`, `page_contact_note` (text, max 4000 each).
- **UI:** Manage → Settings (or a new "Pages" tab) with simple text boxes; storefront footer links open them.
- **Accept:** blank pages are not linked; text is escaped, line breaks kept.

### 2.7 Social links in the footer (free)
- **Data:** `forums.social_links jsonb` (`instagram`, `tiktok`, `facebook`, `x`, `youtube`, `website`), validated https URLs or handles.
- **Accept:** only filled links show; all open in a new tab with `rel="noopener noreferrer"`.

### 2.8 Store QR code (free)
- **UI:** Manage → Overview: QR for the store link (reuse `app/components/PaymentQR.tsx`), "Download PNG" and a print layout with the store name.
- **Accept:** the code opens the live store address (custom domain if verified, else subdomain).

### 2.9 Delivery fees by state, free-delivery threshold, pickup (Pro) *(also "most needed" #3)*
- **Data:** `site_shipping_zones(id, site_id, name, states text[], fee, free_over numeric null, is_active)`; `site_orders.shipping_fee`, `shipping_zone`, `delivery_method` (`delivery`|`pickup`); `forums.pickup_address`.
- **API:** orders POST takes `delivery_method` and `state`; the **server** finds the zone and fee, applies the threshold, adds it to `total_amount`.
- **UI:** owner defines zones (Nigerian states picker); checkout shows fee before placing the order; emails and owner order list show it.
- **Accept:** the browser cannot change the fee; pickup is free; no zone matched shows a clear "we do not deliver there" or the default fee.

### 2.10 Receipts and invoices (Pro)
- **UI/API:** printable page `/receipt/[orderCode]?email=` (same lookup rules as tracking) with logo, items, discount, shipping, total, payment status; "Print or save as PDF" like the existing invoice page (`app/invoice/[id]`); link from the paid email.
- **Accept:** cannot open another buyer's receipt; prints cleanly on A4.

### 2.11 Low-stock alerts and daily sales summary (Pro)
- **Data:** `site_products.low_stock_at int default 3`; `forums.summary_email boolean default true`.
- **Job:** a scheduled route (see `app/api/cron/` if present, else add one guarded by a secret header) sends each Pro owner a morning email: yesterday's orders and money, products at or below the threshold, payments waiting. One immediate alert when stock crosses the threshold.
- **Accept:** no duplicate alerts for the same product per day; owners can turn it off.

### 2.12 Abandoned-cart reminders (Pro)
- **Data:** `site_carts(id, site_id, email, phone, items jsonb, total, status, reminded_at, created_at)`; capture only after the buyer types an email or phone at checkout, with a visible notice.
- **Job:** 1 hour and 24 hours after a cart is left, one email (and a WhatsApp link for the owner to send); stop when an order is placed.
- **Accept:** max two reminders per cart; unsubscribe link; owner sees "carts left" in Overview.

### 2.13 Refunds, returns and private order notes (free notes, Pro refunds log)
- **Data:** `site_orders.internal_note text`; `site_order_events(id, order_id, kind, note, amount, created_at)` for refund/return records.
- **UI:** per order: private note box; "Record refund" (amount, reason) that marks the order and, optionally, returns stock.
- **Accept:** notes are never returned by any public endpoint; refund cannot exceed the order total.

### 2.14 Verified-seller badge
- **Data:** `forums.verified boolean default false`, `verified_at`.
- **Founder:** toggle in Admin → Developa platform after checking the owner's ID/business (a plain checklist the founder defines).
- **UI:** badge on the store header and in the directory.
- **Accept:** only the founder can set it; an owner PATCH cannot.

---

## 3. Payments and payouts (blocked on founder decision 1.4)

Read "Payments decision" in `docs/developa-feature-roadmap.md` and the summary at the end of this file first.

### 3.1 Online payments that confirm themselves *(most needed #1)*
Preferred design (Flutterwave): a **dynamic virtual bank account per order** (buyer transfers the exact amount; the webhook confirms) plus card checkout.
- **Data:** `site_payments(id, site_id, order_id, provider, reference unique, amount, status, provider_ref, raw jsonb, created_at, paid_at)`, RLS on.
- **Env:** `FLW_SECRET_KEY`, `FLW_SECRET_HASH` in `.env.local` and `.env.example` (names only).
- **API:** start (server computes amount), return handler and webhook. The webhook must verify the `verif-hash` header with a timing-safe compare **and** re-verify the transaction with the provider before marking paid. Reference format `DEV_<orderCode>_<random>` so webhooks from the other apps sharing the Flutterwave account are ignored.
- **Fulfilment:** marking paid goes through the **same code path** as the owner's "Mark as paid" button (stock already reserved, buyer email with downloads, owner alert), idempotent on the reference.
- **Fallback:** bank transfer and pay on delivery keep working; online payment is per-store opt-in.
- **Accept:** double webhook delivery pays once; amount mismatch goes to a "needs review" state and alerts the founder; test with Flutterwave's test keys first.

### 3.2 Paying store owners
Depends on the chosen option: (A) Flutterwave subaccounts/splits, or (B) port Subskription's hold-days payout engine (`C:\Users\chati\Documents\subskription\cloudflare-worker\src\lib\payoutHelper.ts`).
- Per-store ledger (`site_ledger`), owner bank details with name verification, payout requests/automatic payouts after `payout_hold_days`, fees from `lib/plans.ts`, founder view of all payouts.
- Never pay the same payout twice (claim pattern as in Subskription); minimum payout; notifications to the owner.
- **Accept:** founder can see money in, fees, owed and paid per store, and it reconciles to the Flutterwave dashboard.

### 3.3 Business plan: card and instant-transfer payments with auto-confirm
Gate packages 3.1/3.2 to Business if the founder wants them as a paid upgrade (add `onlinePayments` and `payouts` flags to `lib/plans.ts`).

---

## 4. Growth and scale

| ID | Package | Tier | Key points |
|---|---|---|---|
| 4.1 | Customer list + CSV export | Pro | Built from orders and members; export is owner-only; include consent flag for marketing |
| 4.2 | Bulk product import (CSV/Excel) | Pro | Template download, row-by-row validation report, respects plan caps and categories; never half-imports silently |
| 4.3 | Staff accounts with roles | Business | `site_staff(site_id, user_id, role)`; roles: manager, packer (orders only), support (orders + community); change `requireOwnedSite` into a role check helper used everywhere |
| 4.4 | Deeper analytics | Pro | Visits, conversion, top products, traffic source; privacy friendly (no raw IPs); charts in Overview |
| 4.5 | Email newsletter | Pro | To customers/members who consented; unsubscribe link; per-plan monthly send cap; uses Resend through a queue |
| 4.6 | Sitemap, robots and product JSON-LD per store | free | `/forums/[slug]/sitemap.xml`; product structured data; honour `is_public` and plan |
| 4.7 | Data export and automatic backup | free export, Pro scheduled | Owner downloads products/orders/customers; weekly backup email link |
| 4.8 | Paid memberships and premium community | Business | Plans per community, manual or online payment, gated threads, expiry handling |
| 4.9 | Booking and appointments | Business | Services with slots, buyer picks a slot, owner confirms, reminders |
| 4.10 | Priority support process | Business | Founder inbox view of Business sites' requests; promised response time shown on the Plan tab |
| 4.11 | Plan expiry reminders | platform | Email owners 7 and 1 days before the plan ends and when it lapses; founder list "ending soon" |
| 4.12 | Founder: edit plan prices/limits without code | platform | Optional later: move `PLANS` numbers to a table; until then edit `lib/plans.ts` |

---

## 5. Cross-cutting checks the reviewer will run on every package

**Security**
- Owner endpoints: 401 without login, 403 for another owner's site (test with two accounts).
- Public endpoints: rate limited, validated, no owner-only fields (`digital_url`, bank details beyond checkout, notes).
- No amounts, fees, discounts or stock decisions taken from the browser.
- Plan limits enforced server-side (try the request with a Starter site).
- User text escaped in HTML, email and JSON-LD; URLs are https; uploads limited by type and size.
- Webhooks: signature checked with a constant-time compare and the event re-verified with the provider.

**Robustness**
- Works with the migration not applied (tolerant read) and after it is applied.
- Idempotent on retry (webhooks, double clicks, refresh after submit).
- Failures show a plain message and leave data consistent (stock returned, no half-created orders).

**Quality**
- 375px, 768px and desktop; keyboard usable; labels on every input; contrast fine in light and dark.
- Plain wording; no filler claims; empty states explain what to do next.
- Lint: do not add new `any` types.

**Review hand-off format**
```
Package: 2.3 Product variants
Branch / commits:
Migration: <file> (applied: yes/no)
Files changed:
How I tested (steps + accounts used):
Not done / unsure:
```

---

## 6. Payments decision (summary for the founder)

- **Flutterwave via the Subskription account:** possible technically (same keys, separate `DEV_` references, separate ledger), but one Flutterwave webhook URL serves the whole account, so Subskription's webhook must forward `DEV_` events to research-writer, and payouts draw from the same Flutterwave balance. Confirm in the Flutterwave dashboard: subaccounts/splits enabled, Transfers enabled and the server IP whitelisted, settlement time, and that the account's business terms allow a marketplace.
- **PocketFi:** used in Nairaguide (virtual accounts and one-off Pro checkout) and in Subskription (virtual account columns and a webhook). Nairaguide's README says it was removed on purpose and should not come back, and Subskription moved to Flutterwave. Recommendation: do not bring it back; one provider means one set of reconciliations.
- **Best fit for Nigerian buyers:** Flutterwave dynamic virtual accounts per order (pay by transfer, confirmed automatically) plus cards.

---

## 7. Review log

### Review 1 (2026-11-14): packages 1.3, 1.5, 2.1 to 2.14, 4.1 to 4.11

**Accepted, with fixes made by the reviewer** (commits `53e7e77`, `77a8ba8` on `feat/2-developa-tools`).
Checked: typecheck, lint of touched files, a guard map of every new API route, row-level security on every new
table, server-side totals/fees/stock in order placement, plan flags enforced on the server, public endpoints
return no owner data, owner/staff endpoints return 401 without login, cron fails closed, no server errors on
public pages while migrations 020000 to 040000 are unapplied.

**Problems found and fixed**
1. *Staff role could be claimed with an unverified email.* Staff invites match by email, so an attacker could
   sign up as an invited address. Now requires a confirmed email (`emailIsConfirmed` in `lib/forumServer.ts`).
2. *`requireOwnedSite` quietly allowed managers.* That opened domain connect/disconnect to managers. Now owner-only
   by default; staff must be listed explicitly.
3. *Managers could change the bank account and site type.* Payment details, currency, visibility, site type,
   template and badge are now owner-only (only a field that really changes is blocked, so a normal manager save works).
4. Receipt endpoint echoed internal error text; cron compared its secret with `!==`; analytics visitor hash was
   unsalted; plan end date was visible to visitors; one lint error (`prefer-const`) was missed.

**Rules learned (apply to all future packages)**
- A permission helper's default must be the safest option. Name and default must agree.
- Anything matched by email needs the email to be confirmed.
- Never trust "typecheck and targeted lint pass" as proof of security: add a test with a second account.

**Not yet verified (needs migrations 020000, 030000, 040000 applied, then the reviewer runs these)**
- As the **owner**: create a product with 3 photos and a size variant; place an order as a buyer; confirm stock drops
  per variant and returns on cancel; mark paid and check the buyer email and downloads; add a delivery zone and
  check the fee at checkout; leave a review from a paid order; export customers and open the CSV in a spreadsheet.
- As a **second account**: confirm 403 on every owner endpoint of someone else's store.
- As **staff** (Business plan): invite a packer; confirm they can see orders but not customers, export, bank
  details, staff or domain.
- Newsletter: send to two consented subscribers; confirm the unsubscribe link works and the monthly cap holds.
- Cron: call `/api/cron/developa-daily` with and without `CRON_SECRET`.
- Owner dashboard authenticated tabs (the agent's browser run only saw the signed-out empty state).

**Known small items left for later:** unsubscribe links change state on GET (an email scanner could trigger them;
consider a confirm button); the daily cron sends emails in one loop and may need batching beyond a few hundred
stores; several older endpoints still return raw `err.message` to the browser.
