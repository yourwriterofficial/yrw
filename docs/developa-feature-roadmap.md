# developa.me: what a site owner can manage

> **Approved by the founder on 2026-11-14: all 60 items below are to be implemented.**
> Work through the "Suggested build order" at the bottom. Items marked *built* are done; everything marked
> *not yet* or *partly* is the backlog. Update the Status column as items ship.

Three lists of 20: what the free plan should include, what is worth paying for, and what owners need most.
Status: **built** = works today, **partly** = exists but basic, **not yet** = to build.

The goal of the split: the free plan must be good enough that a seller can run a real shop and tell friends,
and the paid plans must remove a real pain (growth, time, trust), never basic selling.

## 20 features for the free plan (Starter)

| # | Feature | Status |
|---|---|---|
| 1 | Own address `yourname.developa.me` | built |
| 2 | Up to 10 products with photo, price, old price and stock | built |
| 3 | Categories, search and sorting for shoppers | built |
| 4 | Pay by bank transfer or pay on delivery | built |
| 5 | Order list: mark paid, reject, delivery progress | built |
| 6 | Email to the buyer when an order is placed and whenever its status changes | built |
| 7 | New-order alert to the owner | built |
| 8 | Digital downloads released automatically once payment is confirmed | built |
| 9 | Store logo, colour and banner headline | built |
| 10 | Announcement bar (a sale, free delivery) | built |
| 11 | Own Google title and description | built |
| 12 | Fast, mobile-first pages | built |
| 13 | Owner overview: money received, orders, best sellers, getting-started checklist | built |
| 14 | Community forum with threads and replies | built |
| 15 | Pin, lock and delete discussions | built |
| 16 | Share link with copy button | built |
| 17 | WhatsApp button on every product (not only after an order) | built |
| 18 | About, Contact and Delivery/Returns pages | built |
| 19 | Social links (Instagram, TikTok, Facebook) in the footer | built |
| 20 | QR code for the store, to print on packaging and posters | built |

## 20 features worth paying for (Pro ₦7,500 and Business ₦20,000 a month)

**Pro**

| # | Feature | Status |
|---|---|---|
| 1 | Your own domain (yourbrand.com), DNS-verified | built |
| 2 | Unlimited products | built |
| 3 | Discount coupons (percent or fixed, limits, end date) | built |
| 4 | No "Powered by Developa" badge and no platform ads | built |
| 5 | Delivery fees by state or zone, free-delivery threshold, pickup option | built |
| 6 | Product variants (size, colour, storage) with stock per variant | built |
| 7 | Several photos per product | built |
| 8 | Customer reviews and star ratings | built |
| 9 | Abandoned-cart reminder by WhatsApp or email | built |
| 10 | Low-stock alerts and a daily sales summary email | built |
| 11 | Customer list with CSV export | built |
| 12 | Bulk product import from CSV or Excel | built |
| 13 | Printable invoices and receipts with your logo | built |
| 14 | Deeper analytics: visits, conversion, where buyers come from | built |
| 15 | Email newsletter to customers and members | built |

**Business**

| # | Feature | Status |
|---|---|---|
| 16 | Staff accounts with roles (packer, support, manager) | built |
| 17 | Card and instant-transfer payments (Paystack or Flutterwave) that confirm orders automatically | not yet |
| 18 | Paid memberships and a premium community | built |
| 19 | Booking and appointments for service businesses | built |
| 20 | Priority WhatsApp support and done-for-you setup | built |

## 20 most needed features, in order

Ranked by how much they help a first-time Nigerian seller sell more or lose less. Some are free, some paid.

| # | Feature | Why it matters | Status |
|---|---|---|---|
| 1 | Online payments that confirm themselves | Owners check bank alerts by hand today, which is slow and error-prone | not yet |
| 2 | Stock goes down when something sells, and comes back on cancel | Otherwise one item can be sold again and again | built (this release) |
| 3 | Delivery fees by state, plus pickup | Delivery cost is the first buyer question | built |
| 4 | WhatsApp button on every product and a shareable product link | Most sales conversations happen on WhatsApp | built |
| 5 | Variants (size, colour) | Fashion, phones and shoes cannot be sold without them | built |
| 6 | Several photos per product | Buyers do not buy what they cannot see | built |
| 7 | Order tracking page for buyers | Fewer "where is my order?" messages | built |
| 8 | Receipts and invoices | Proof of purchase, and trust | built |
| 9 | Reviews and ratings | The strongest trust signal for a new store | built |
| 10 | Abandoned-cart recovery | Recovers sales already almost made | built |
| 11 | Low-stock alerts | Stops stock-outs and missed sales | built |
| 12 | Coupons | Promotions and first-order discounts | built |
| 13 | Customer list and export | Owners need to reach past buyers | built |
| 14 | Google title, description, sitemap | Free traffic | built |
| 15 | Bulk import | Sellers with 100 items cannot type them one by one | built |
| 16 | Refunds, returns and private order notes | Real businesses need them | built |
| 17 | Staff accounts | Owners cannot answer every order alone | built |
| 18 | Policy and info pages (About, Delivery, Returns, Contact) | Buyers look for them before paying | built |
| 19 | Data export and automatic backup | Owners fear losing their shop | built |
| 20 | Verified-seller badge | Fights scam fears around online shops | built |

## Suggested build order

1. Online payments (1) and delivery fees (3): the two that change revenue most.
2. WhatsApp on every product (4), several photos (6), variants (5): what shoppers see.
3. Receipts (8), reviews (9), abandoned carts (10): trust and recovery.
4. Customer list (13), bulk import (15), staff (17): scaling.

## Paying store owners automatically (research notes, 2026-11-14)

Feature 1 of the "most needed" list (online payments) leads to a second question: how does a store owner
get their money? Today buyers transfer straight to the owner's own bank account, so the platform never
holds money and there is nothing to pay out.

**What the Subskription project already has** (`C:\Users\chati\Documents\subskription`):

- A `withdrawals` table: a seller requests a payout with their bank details.
- `marketplace_settings`: `auto_payout_enabled` (default off), `payout_hold_days` (default 7),
  `payout_fee_flat` and `payout_fee_pct`.
- An automatic payer that runs twice an hour (cron `3,33 * * * *`). It pays every pending bank withdrawal that
  is older than the hold period, using the Flutterwave Transfers API, then notifies the seller (in-app and push).
- Safety: an atomic claim so one withdrawal can never be paid twice; minimum net payout of ₦100; bank-name
  to bank-code matching; premium sellers get a reduced fee; a payout can also be returned to the seller's wallet.
- Code: `cloudflare-worker/src/lib/payoutHelper.ts`, `supabase/functions/process-auto-payouts`,
  `supabase/functions/flutterwave-payout`.

**Is it used by research-writer today?** No. Subskription's payments run on its own database and wallet, and
it has no API for other apps. research-writer currently takes manual bank transfers only.

**Options to credit store owners' bank accounts automatically after N days**

1. **Flutterwave subaccounts and split payments (recommended first):** each store owner becomes a subaccount;
   a buyer's card or transfer payment is split at checkout and Flutterwave settles the owner's share to their
   bank on its own settlement schedule. The platform never holds the money, so no payout engine, no extra
   regulatory exposure, and the platform fee is taken by the split. To check: that this is enabled on the live
   Flutterwave account, and the settlement timing shown in its dashboard.
2. **Port the Subskription payout engine** (hold days + auto payout): platform collects every payment, keeps a
   per-store balance, and pays owners after a hold period (for example 3 or 7 days). This gives buyer
   protection and lets the founder choose the hold days and fee, but it means holding customers' money, which
   can carry licensing duties; get advice first.
3. **Manual payouts by the founder** (works today with a recorded ledger): simplest, but does not scale.

**Needed whichever option is chosen:** the Flutterwave secret key and webhook hash in research-writer's
`.env.local` (they live in Subskription's server secrets, not in any `.env` file), a webhook that confirms
payments, and each owner's verified bank details.
