# Developa: what is free, Pro and Business, and what to build next

Plan rules live in `lib/plans.ts`. The plugin list (`lib/plugins.ts`) reads from them, so the Plugins tab in Admin can never promise something the plan does not give.

## Decided and built

| Feature | Plan | Why |
|---|---|---|
| 1 site per account | Free | Enough to try the product. |
| 4 sites | Pro | A seller with a shop, a blog and a portfolio. |
| 8 sites | Business | Agencies and resellers. A site counts as paid only if the founder recorded a payment, so the 3-day trial cannot be used to open several. |
| Install as a phone app | Free | Costs us nothing and keeps free sellers coming back. |
| Phone alerts for orders | Pro | Sending push is cheap, but it is what sellers pay for first. |
| Chat between buyer and seller | Pro | Free sellers already get WhatsApp buttons. Chat adds support load and email volume, so it is a paid feature. |
| Sell ad space on your own site | Pro | Pays for itself in a month, which makes the upgrade easy to justify. |
| Premium themes | One-off price per theme | Founder sets each price in Admin, Themes and prices. |
| Platform ads | Free sites only | Shown on the site and in the owner Admin overview. Pro and Business remove them. |

## Ideas taken from the other projects

| Idea | From | Suggested plan | Notes |
|---|---|---|---|
| Referral and affiliate links for site owners (earn when someone upgrades through their link) | Subskription affiliate system, `apply-referral` here | Free to join, payout rules by plan | Strongest growth lever toward the yearly target: every seller becomes a seller of Developa. |
| Group-buy and shared subscription products with renewal reminders | Subskription | Pro | The Subskription theme is already there; reminders are the missing part. |
| Abandoned checkout reminders | ProsePen | Pro (already built as Abandoned carts) | Keep. |
| Notification de-duplication (same alert never twice in 10 minutes) | ProsePen | All | Worth copying into site push so owners are never spammed. |
| Writing helpers for blog posts (proofread, readability) | ProsePen desk | Pro, as a paid add-on | Needs a cost per use, so keep it behind coins or a higher plan. |
| Support tickets and priority queue | This site | Business (already built) | Keep. |
| Invoices with payment links | This site | Pro | Sellers sending invoices to their own customers would be a strong Pro feature. |
| Wallet balance | This site, Subskription | Later | Only worth it once payments are automatic (see below). |

## Running on free hosting tiers (hobby plans)

What was checked:

- Cron: two daily jobs only (`vercel.json`). That fits Vercel Hobby.
- Public pages are cached (`s-maxage`) where they read the same data for everyone: site list, ad space.
- Chat refreshes every 8 to 10 seconds only while a chat window is open. No always-on connections.
- Images go to Google Drive through the Apps Script uploader, not the database. Emails go through the Apps Script mailer first (about 100 a day on Gmail), then fall back to the normal email service.
- Clean-up of abandoned free sites keeps the database small (6 months, two warning emails).
- Every new feature reads tolerantly, so a missing table never breaks a page.

Limits to know about before growing:

- **Supabase Free pauses a project after 7 days with no activity.** A live business should not sit on that tier; the paid tier is the first upgrade to make.
- **Vercel Hobby is for personal, non-commercial use** under Vercel's terms. A paid service should move to Vercel Pro before taking real money.
- Supabase Free has a 500 MB database and a monthly bandwidth cap. Cached public endpoints and Drive images keep both low, but watch them once there are a few hundred sites.

## Payments for things sold on Developa

Today everything is a manual bank transfer confirmed by the founder (plans, themes, ad space between a seller and their advertiser). That works for the first hundred customers and is the right default for a hobby-tier setup. The ProsePen route (Paystack on a shared account, confirm when the buyer returns, a reconcile job for the ones that never come back, and no dependence on a webhook) can be copied here when volume makes manual confirmation slow. Delivery is then automatic: the same code that the founder's "money received" button runs would run on a verified payment.
