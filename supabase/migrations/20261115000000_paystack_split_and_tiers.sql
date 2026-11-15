-- Phase 1: 5-tier plan support, Paystack subaccount split columns, and house ads flag.
-- Safe to re-run (idempotent).

-- 1. Expand plan_tier constraints to include lite & corporate
ALTER TABLE public.forums DROP CONSTRAINT IF EXISTS forums_plan_tier_check;
ALTER TABLE public.forums
  ADD CONSTRAINT forums_plan_tier_check
  CHECK (plan_tier = ANY (ARRAY['free'::text, 'lite'::text, 'pro'::text, 'business'::text, 'corporate'::text]));

ALTER TABLE public.site_plan_payments DROP CONSTRAINT IF EXISTS site_plan_payments_plan_tier_check;
ALTER TABLE public.site_plan_payments
  ADD CONSTRAINT site_plan_payments_plan_tier_check
  CHECK (plan_tier = ANY (ARRAY['lite'::text, 'pro'::text, 'business'::text, 'corporate'::text]));

-- 2. Add status + unique reference index on site_plan_payments for atomic Paystack verification
ALTER TABLE public.site_plan_payments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid';

ALTER TABLE public.site_plan_payments DROP CONSTRAINT IF EXISTS site_plan_payments_status_check;
ALTER TABLE public.site_plan_payments
  ADD CONSTRAINT site_plan_payments_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_plan_payments_reference
  ON public.site_plan_payments (reference)
  WHERE reference IS NOT NULL AND reference <> '';

-- 3. Paystack subaccount columns on forums (for seller split payouts)
ALTER TABLE public.forums
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_bank_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_account_name TEXT,
  ADD COLUMN IF NOT EXISTS paystack_split_fee_pct NUMERIC(5,2) DEFAULT 2.00;

-- 4. Split ledger columns on site_orders
ALTER TABLE public.site_orders
  ADD COLUMN IF NOT EXISTS paystack_reference TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee_ngn NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_net_ngn NUMERIC(12,2) DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_orders_paystack_ref
  ON public.site_orders (paystack_reference)
  WHERE paystack_reference IS NOT NULL AND paystack_reference <> '';

-- 5. House ad flag on site_ad_bookings (for paid owners placing ads on their own site)
ALTER TABLE public.site_ad_bookings
  ADD COLUMN IF NOT EXISTS is_house_ad BOOLEAN NOT NULL DEFAULT false;

-- 6. Ensure site_limits / maxSitesFor only counts paid plan payments when status = 'paid'
CREATE INDEX IF NOT EXISTS idx_site_plan_payments_site_status
  ON public.site_plan_payments (site_id, status);
