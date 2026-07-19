

-- ==========================================
-- MIGRATION: 20260717120000_email_logs.sql
-- ==========================================

-- ── Email logging ──────────────────────────────────────────────────────────
--
-- Every email the platform sends passes through the `send-email` edge function:
-- the frontend calls it via supabase.functions.invoke (src/lib/email.ts), and the
-- DB triggers call the same URL via pg_net (see 20260704150000). So one row
-- written inside that function captures the whole system with no per-caller work.
--
-- `html` stores the FINAL rendered document — the exact bytes handed to Resend,
-- template and all — so the admin preview shows what the recipient actually saw,
-- not an approximation rebuilt from the parts.

CREATE TABLE IF NOT EXISTS public.email_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  to_email    TEXT        NOT NULL,
  subject     TEXT        NOT NULL,
  -- Event tag from the caller ('new_order', 'new_message', …). NULL = untagged
  -- transactional mail, which always sends.
  event       TEXT,
  -- The fully-wrapped HTML document. Nullable: a 'skipped' row never rendered one.
  html        TEXT,
  -- 'sent'    — a provider accepted it
  -- 'failed'  — every provider rejected it
  -- 'skipped' — an admin toggle in marketplace_settings gated this event off.
  --             Logged rather than dropped, so "why didn't X get an email?" is
  --             answerable instead of invisible.
  status      TEXT        NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  -- Which provider actually delivered: 'resend' | 'google_apps_script'.
  via         TEXT,
  -- Provider error text on failure, or the skip reason.
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The admin list is "newest first", optionally filtered. These cover both.
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_status_idx     ON public.email_logs (status);
CREATE INDEX IF NOT EXISTS email_logs_event_idx      ON public.email_logs (event);
CREATE INDEX IF NOT EXISTS email_logs_to_email_idx   ON public.email_logs (to_email);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Admins read; nobody else. These rows contain recipient addresses and the full
-- message body, including anything a transactional mail embeds — so this table is
-- strictly more sensitive than the notifications it mirrors. No user-facing policy.
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;
CREATE POLICY "Admins can view email logs" ON public.email_logs
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- No INSERT/UPDATE/DELETE policy on purpose: writes come from the edge function
-- using the service_role key, which bypasses RLS. Leaving the table otherwise
-- closed means a compromised client cannot forge or erase the audit trail.

-- ── Retention ──────────────────────────────────────────────────────────────
-- Full HTML bodies are ~5–10 kB each, so this is the one table here that grows
-- without bound. 90 days is well past the point where a delivery question is
-- still live. Schedule with pg_cron alongside the existing jobs, e.g.:
--   SELECT cron.schedule('prune-email-logs', '0 4 * * *', 'SELECT public.prune_email_logs()');
CREATE OR REPLACE FUNCTION public.prune_email_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.email_logs WHERE created_at < now() - INTERVAL '90 days';
$$;


-- ==========================================
-- MIGRATION: 20260717150000_schedule_prune_email_logs.sql
-- ==========================================

-- Schedule the 90-day retention sweep for email_logs.
--
-- 20260717120000 defined prune_email_logs() but never scheduled it, so the table
-- grew without bound. It stores full rendered HTML bodies (~5-10 kB/row), which
-- makes it the fastest-growing table in the schema — see the retention note there.
--
-- Mirrors the existing `prune-nin-data` job (a plain SELECT of a SECURITY DEFINER
-- function; no pg_net, so no service_role token is embedded in the command).
-- 04:00 UTC sits in the quiet window between expire-marketplace (02:00) and
-- check-low-balance (08:00).

-- cron.schedule() upserts by name, so re-running this migration is safe.
SELECT cron.schedule(
  'prune-email-logs',
  '0 4 * * *',
  $$SELECT public.prune_email_logs()$$
);


-- ==========================================
-- MIGRATION: 20260717160000_backfill_historical_email_logs.sql
-- ==========================================

-- Show emails that predate email logging, without lying about them.
--
-- email_logs starts at the moment send-email began writing rows (2026-07-17), so
-- the admin page opens empty and looks broken. There IS a record of earlier mail:
-- `notifications.send_email = true` means the app asked send-email to deliver that
-- notification.
--
-- But note exactly what that record does and does not prove:
--   * it proves an email was REQUESTED — not that a provider accepted it
--   * the rendered HTML was never stored anywhere, so there is no body to show
--   * it only covers notification-driven mail. Message/order mail that went
--     straight to the edge function left no trace and cannot be recovered.
--
-- So these rows get their own status rather than being dressed up as 'sent'.
-- Calling them 'sent' would assert a delivery this data cannot support, in the
-- one table an admin consults to answer "did this actually go out?".

ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;
ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_status_check
  CHECK (status IN ('sent', 'failed', 'skipped', 'historical'));

COMMENT ON COLUMN public.email_logs.status IS
  'sent = a provider accepted it; failed = every provider rejected it; '
  'skipped = gated off by a marketplace_settings toggle; '
  'historical = reconstructed from notifications for mail sent before logging '
  'existed — delivery outcome unknown and no body was captured.';

-- Idempotent: a partial unique index makes the backfill safe to re-run and stops
-- a second run from duplicating rows.
CREATE UNIQUE INDEX IF NOT EXISTS email_logs_historical_unique
  ON public.email_logs (to_email, subject, created_at)
  WHERE status = 'historical';

INSERT INTO public.email_logs (to_email, subject, event, html, status, via, error, created_at)
SELECT
  p.email,
  n.title,
  -- notifications.type is the app's own category ('Payment', 'Expiring', …), not
  -- one of send-email's event keys. Lowercased so it reads consistently with the
  -- real event tags in the same column.
  lower(n.type),
  NULL,                       -- no body was ever rendered to disk
  'historical',
  NULL,                       -- provider not recorded
  'Reconstructed from the notifications table. This email was requested before '
  || 'email logging existed, so its delivery outcome and body were never recorded.',
  n.sent_at
FROM public.notifications n
JOIN public.profiles p ON p.id = n.user_id
WHERE n.send_email = true
  AND p.email IS NOT NULL
ON CONFLICT DO NOTHING;


-- ==========================================
-- MIGRATION: 20260717170000_expire_user_ad_purchases.sql
-- ==========================================

-- Migration: Expire user-purchased ads (banners + product boosts) once their paid window ends.
--
-- Gap: expire_all_expired_privileges() (see 20260701140000, 20260704080001) already PERFORMs
-- deactivate_expired_ads() and expire_product_boosts(), but neither function is defined anywhere
-- in this migration history, so if they aren't present live, that whole call throws and NOTHING
-- in expire_all_expired_privileges() runs. This migration adds a self-contained function for
-- user_ad_purchases specifically, called directly from check-expiring-orders so ad expiry works
-- independent of that other function's state.

-- Backfill: the client used to insert auto-approved ads with status='active', which the rest of
-- the app (admin dashboard, this table's own status colors) never recognized as a valid status —
-- those ads were live in the DB but displayed nowhere as "approved". Normalize them.
UPDATE public.user_ad_purchases SET status = 'approved' WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.expire_user_ad_purchases()
RETURNS void AS $$
BEGIN
  -- Un-boost any product listings whose boost window has ended.
  UPDATE public.seller_products sp
  SET is_boosted = false
  FROM public.user_ad_purchases uap
  WHERE sp.id = uap.product_id
    AND uap.is_boost = true
    AND uap.status = 'approved'
    AND uap.ends_at IS NOT NULL
    AND uap.ends_at < NOW();

  -- Flip the purchase itself to 'expired' so My Ads / admin reporting reflect it honestly.
  UPDATE public.user_ad_purchases
  SET status = 'expired'
  WHERE status = 'approved'
    AND ends_at IS NOT NULL
    AND ends_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- MIGRATION: 20260717180000_admin_delete_user.sql
-- ==========================================

-- Migration: admin_delete_user — let an admin permanently delete a user account.
--
-- Deleting auth.users cascades to profiles and every ON DELETE CASCADE / SET NULL
-- child, but a handful of references are ON DELETE NO ACTION and would block the
-- delete with a FK violation. This function clears those first, then deletes the
-- auth user, all inside one transaction so a failure rolls back cleanly.
--
-- Security: SECURITY DEFINER, but it authenticates the caller via auth.uid() and
-- refuses anyone who isn't an admin — so EXECUTE can safely be granted to
-- authenticated. It also refuses self-deletion and blocks deleting a founder
-- unless the caller is themselves a founder.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller           uuid := auth.uid();
  v_caller_is_admin  boolean;
  v_caller_is_founder boolean;
  v_target_exists    boolean;
  v_target_is_founder boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_admin, COALESCE(is_founder, false)
    INTO v_caller_is_admin, v_caller_is_founder
    FROM public.profiles WHERE id = v_caller;

  IF NOT COALESCE(v_caller_is_admin, false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  IF p_target_id = v_caller THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  SELECT true, COALESCE(is_founder, false)
    INTO v_target_exists, v_target_is_founder
    FROM public.profiles WHERE id = p_target_id;

  IF NOT COALESCE(v_target_exists, false) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target_is_founder AND NOT v_caller_is_founder THEN
    RAISE EXCEPTION 'Only a founder can delete a founder account';
  END IF;

  -- Remove the user's own rows in NO ACTION tables (these would block the delete).
  DELETE FROM public.activity_logs            WHERE user_id     = p_target_id;
  DELETE FROM public.auto_renewals            WHERE user_id     = p_target_id;
  DELETE FROM public.verification_applications WHERE user_id    = p_target_id;
  DELETE FROM public.seller_reviews           WHERE reviewer_id = p_target_id; -- reviewer_id is NOT NULL

  -- Null out references where this user was merely the acting admin on someone
  -- else's record (all nullable columns).
  UPDATE public.verification_applications SET reviewed_by        = NULL WHERE reviewed_by        = p_target_id;
  UPDATE public.marketplace_orders        SET dispute_resolved_by = NULL WHERE dispute_resolved_by = p_target_id;
  UPDATE public.seller_email_blasts       SET initiated_by       = NULL WHERE initiated_by       = p_target_id;
  UPDATE public.seller_products           SET approved_by        = NULL WHERE approved_by        = p_target_id;
  UPDATE public.sellers                   SET approved_by        = NULL WHERE approved_by        = p_target_id;

  -- Delete the auth user; profiles + all CASCADE/SET NULL children follow.
  DELETE FROM auth.users WHERE id = p_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;


-- ==========================================
-- MIGRATION: 20260718105527_unify_metered_billing.sql
-- ==========================================

-- Migration: unify CPM + CPC into a single "metered" billing model.
--
-- BEFORE: billing_model was one of 'per_day' | 'cpm' | 'cpc' — mutually
-- exclusive. A metered ad billed EITHER per-impression (cpm) OR per-click
-- (cpc), never both, and admins had to pick one per slot.
--
-- AFTER: billing_model is 'per_day' | 'metered'. A metered slot carries BOTH
-- a cpm_rate (₦ per 1,000 impressions) AND a cpc_rate (₦ per click); every
-- impression AND every click bills against the same pre-paid budget. Either
-- rate may be 0/NULL to switch that dimension off, so the old cpm-only and
-- cpc-only behaviours are still expressible — this augments, it doesn't remove.
--
-- Per-day is untouched and remains the default (augment, don't replace — the
-- house rule for this system).
--
-- DATA MIGRATION: existing 'cpm'/'cpc' rows (in ad_pricing AND the immutable
-- rate snapshot on user_ad_purchases) become 'metered' with their single rate
-- preserved and the other left NULL. So a live cpm campaign keeps billing
-- exactly as before (impressions charge cpm_rate/1000; clicks charge
-- COALESCE(cpc_rate,0)=0 → no-op), and a live cpc campaign likewise. No active
-- campaign's economics change.

-- 1. Drop the old CHECK constraints (robust to auto-generated names) BEFORE
--    rewriting the data — updating a row to 'metered' would violate the old
--    ('per_day','cpm','cpc') check.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.ad_pricing'::regclass, 'public.user_ad_purchases'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%billing_model%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- 2. Collapse the two old metered variants into one. Rates are left as-is;
--    the NULL dimension simply bills nothing (see bill_metered_ad_event).
UPDATE public.ad_pricing        SET billing_model = 'metered' WHERE billing_model IN ('cpm', 'cpc');
UPDATE public.user_ad_purchases SET billing_model = 'metered' WHERE billing_model IN ('cpm', 'cpc');

-- 3. Re-add the CHECK with the new, smaller vocabulary.
ALTER TABLE public.ad_pricing
  ADD CONSTRAINT ad_pricing_billing_model_check CHECK (billing_model IN ('per_day', 'metered'));
ALTER TABLE public.user_ad_purchases
  ADD CONSTRAINT user_ad_purchases_billing_model_check CHECK (billing_model IN ('per_day', 'metered'));

-- 4. Meter a single impression/click against a metered purchase's pre-paid
--    budget. Now BOTH event types can bill (previously a click on a cpm ad,
--    or an impression on a cpc ad, was a deliberate no-op). Still a no-op for
--    per_day rows and for whichever rate is 0/NULL. FOR UPDATE serializes
--    concurrent events on the same ad so two page loads can't both read a
--    stale `spent`.
CREATE OR REPLACE FUNCTION public.bill_metered_ad_event(p_id uuid, p_event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_ad_purchases;
  v_cost numeric;
BEGIN
  SELECT * INTO v_row FROM public.user_ad_purchases WHERE id = p_id AND status = 'approved' FOR UPDATE;
  IF v_row IS NULL OR v_row.billing_model = 'per_day' THEN RETURN; END IF;

  -- Both dimensions bill now; the missing rate just contributes 0.
  IF p_event = 'impression' THEN
    v_cost := COALESCE(v_row.cpm_rate, 0) / 1000;
  ELSIF p_event = 'click' THEN
    v_cost := COALESCE(v_row.cpc_rate, 0);
  ELSE
    RETURN;
  END IF;
  IF v_cost <= 0 THEN RETURN; END IF;

  UPDATE public.user_ad_purchases SET spent = spent + v_cost WHERE id = p_id;

  IF v_row.spent + v_cost >= COALESCE(v_row.budget, 0) THEN
    UPDATE public.user_ad_purchases SET status = 'expired' WHERE id = p_id;
    PERFORM public.promote_waitlisted_ads(v_row.position);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.bill_metered_ad_event(uuid, text) FROM PUBLIC;


-- ==========================================
-- MIGRATION: 20260718105547_multi_placement_purchase.sql
-- ==========================================

-- Migration: atomic multi-placement ad purchase.
--
-- Lets a buyer place ONE ad across several sections (header, footer, sidebar,
-- inline, popup — and boosts) in a single checkout. Billing is per-section,
-- summed: each placement keeps its own duration/budget and creates its own
-- user_ad_purchases row (so rotation, capacity and metering stay correct per
-- slot), and the buyer is charged the sum once.
--
-- WHY AN RPC (not N client inserts): the money side must be atomic. A client
-- loop that deducts credits then inserts rows can partially fail — credits gone,
-- some rows missing. This deducts once and inserts every row in one
-- transaction, so either the whole campaign lands or nothing does and the
-- balance is untouched. The per-placement status / starts_at / ends_at /
-- capacity_wait are still decided client-side (they depend on seller plan,
-- auto-approve settings and live slot occupancy) and passed in; the RPC trusts
-- only the money-relevant invariant it can enforce itself: user_id is forced to
-- the caller, and the debit is the authoritative SUM of the rows' amount_paid.

CREATE OR REPLACE FUNCTION public.purchase_ad_placements(p_user_id uuid, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric := 0;
  v_cur   numeric;
  r       jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'No placements to purchase';
  END IF;

  -- Authoritative cost = sum of the rows' own amount_paid.
  SELECT COALESCE(SUM((elem->>'amount_paid')::numeric), 0) INTO v_total
    FROM jsonb_array_elements(p_rows) elem;
  IF v_total < 0 THEN RAISE EXCEPTION 'Invalid total'; END IF;

  -- Debit ad credits once, atomically (mirrors deduct_ad_credits).
  SELECT ad_credits_balance INTO v_cur FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_cur IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF v_cur < v_total THEN RAISE EXCEPTION 'Insufficient ad credits balance'; END IF;
  UPDATE public.profiles SET ad_credits_balance = ad_credits_balance - v_total WHERE id = p_user_id;

  -- Insert every placement. user_id is forced to the caller — never taken from
  -- the row — so this can't be used to plant ads under another account.
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.user_ad_purchases (
      user_id, title, image_url, image_mobile_url, link_url, cta_text,
      position, pages, duration_days, is_boost, product_id, amount_paid,
      status, capacity_wait, starts_at, ends_at, billing_model, budget, cpm_rate, cpc_rate
    ) VALUES (
      p_user_id,
      r->>'title',
      NULLIF(r->>'image_url', ''),
      NULLIF(r->>'image_mobile_url', ''),
      NULLIF(r->>'link_url', ''),
      r->>'cta_text',
      r->>'position',
      COALESCE((SELECT array_agg(value) FROM jsonb_array_elements_text(r->'pages') AS value), ARRAY['all']),
      COALESCE((r->>'duration_days')::int, 7),
      COALESCE((r->>'is_boost')::boolean, false),
      NULLIF(r->>'product_id', '')::uuid,
      COALESCE((r->>'amount_paid')::numeric, 0),
      COALESCE(r->>'status', 'pending'),
      COALESCE((r->>'capacity_wait')::boolean, false),
      NULLIF(r->>'starts_at', '')::timestamptz,
      NULLIF(r->>'ends_at', '')::timestamptz,
      COALESCE(r->>'billing_model', 'per_day'),
      NULLIF(r->>'budget', '')::numeric,
      NULLIF(r->>'cpm_rate', '')::numeric,
      NULLIF(r->>'cpc_rate', '')::numeric
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_ad_placements(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_ad_placements(uuid, jsonb) TO authenticated;


-- ==========================================
-- MIGRATION: 20260718120000_ad_impression_click_rpcs.sql
-- ==========================================

-- Migration: RPCs for ad impression/click tracking.
--
-- Bug found while wiring PromoBanner to also render approved user_ad_purchases
-- (previously, purchased ads never rendered anywhere at all — separate fix):
-- verifying click-through revealed the EXISTING impression/click tracking on
-- the `ads` table has always silently failed for anyone who isn't an admin.
-- `ads` RLS only grants UPDATE via "Admins can manage ads" (admin-only) — there
-- was never a policy letting an ordinary visitor increment impressions/clicks.
-- The client code swallows the resulting RLS error
-- (`.then(() => {}, () => {})`), so it never surfaced as a visible failure —
-- ad analytics have simply been zero for every non-admin viewer.
--
-- `user_ad_purchases` has the same shape of gap: only the purchaser
-- (auth.uid() = user_id) or an admin can UPDATE it, so a buyer clicking on
-- someone else's purchased ad can't increment its counters either.
--
-- Fix: two narrow SECURITY DEFINER RPCs that increment counters atomically
-- (avoids the client-computed `clicks + 1` race/tamper risk of the old direct
-- `.update()` calls) without granting a broad UPDATE policy that would let any
-- visitor rewrite arbitrary columns (status, amount_paid, etc.) on either table.

CREATE OR REPLACE FUNCTION public.increment_ad_impression(p_source text, p_ad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_source = 'ads' THEN
    UPDATE public.ads SET impressions = impressions + 1 WHERE id = p_ad_id;
  ELSIF p_source = 'user_ad_purchases' THEN
    UPDATE public.user_ad_purchases SET impressions = impressions + 1 WHERE id = p_ad_id AND status = 'approved';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_ad_click(p_source text, p_ad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_source = 'ads' THEN
    UPDATE public.ads SET clicks = clicks + 1 WHERE id = p_ad_id;
  ELSIF p_source = 'user_ad_purchases' THEN
    UPDATE public.user_ad_purchases SET clicks = clicks + 1 WHERE id = p_ad_id AND status = 'approved';
  END IF;
END;
$$;

-- Ads render for guests too (Landing header/footer), so anon needs EXECUTE —
-- these only ever increment a counter, never read or expose data back.
REVOKE ALL ON FUNCTION public.increment_ad_impression(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_ad_click(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_ad_impression(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ad_click(text, uuid) TO anon, authenticated;


-- ==========================================
-- MIGRATION: 20260718150000_ad_capacity_pause_and_page_views.sql
-- ==========================================

-- Migration: per-slot ad capacity (max 6 concurrent per position), pause/resume for
-- live purchased ads, and a lightweight page-view log to ground future ad-pricing
-- suggestions in real traffic instead of guesses.
--
-- Capacity model (user_ad_purchases only — admin's own `ads` rows are unmetered,
-- same as always; the admin tool was never rate-limited and this doesn't start now):
--   status: 'pending' | 'approved' | 'rejected' | 'expired'   (unchanged values)
--   capacity_wait: only meaningful while status='pending'. false = the normal
--     "awaiting admin content review" queue (existing meaning). true = content is
--     already fine (auto-approved or admin-approved) but the slot was full at that
--     moment, so it's parked here instead of going live. approved_at is still
--     stamped when content is approved, independent of whether it went live.
--   paused_at: only meaningful while status='approved'. NULL = live/occupying a
--     slot. Non-null = the buyer paused it themselves — it stops occupying a slot
--     and stops counting down (ends_at is pushed forward by the paused duration on
--     resume), but keeps status='approved' since it's still theirs, just parked.
--
-- "Occupying a slot" (counts toward the cap of 6, and is what PromoBanner renders)
-- = status='approved' AND paused_at IS NULL AND (ends_at IS NULL OR ends_at > now()).

ALTER TABLE public.user_ad_purchases
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS capacity_wait boolean NOT NULL DEFAULT false;

-- ── Page views: foundation for traffic-based ad pricing suggestions later. ──────
-- Deliberately minimal: no user identity, just which page and when. Write-only for
-- visitors, readable only by admins (for aggregating into pricing suggestions).
CREATE TABLE IF NOT EXISTS public.page_views (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  page text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_views_page_created ON public.page_views (page, created_at);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a page view" ON public.page_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can read page views" ON public.page_views
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Unbounded INSERT-only tables grow forever — prune to a rolling 180 days, which is
-- plenty for a "recent traffic by page" pricing signal.
CREATE OR REPLACE FUNCTION public.prune_page_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.page_views WHERE created_at < now() - interval '180 days';
END;
$$;

-- ── Slot occupancy: how many ads (admin ads + live purchases) are currently in a
-- given position, and when the earliest one frees up. Exposed as a narrow RPC
-- rather than a SELECT policy so buyers can see honest "X/6 used, next free ~date"
-- without being able to read the underlying rows (titles, amounts, owners) of
-- other users' purchases.
CREATE OR REPLACE FUNCTION public.get_slot_occupancy(p_position text)
RETURNS TABLE(occupied int, slot_cap int, next_free_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH occupying AS (
    SELECT end_date AS ends_at FROM public.ads
      WHERE position = p_position AND is_active = true
        AND (start_date IS NULL OR start_date <= now())
        AND (end_date IS NULL OR end_date >= now())
    UNION ALL
    SELECT ends_at FROM public.user_ad_purchases
      WHERE position = p_position AND status = 'approved' AND paused_at IS NULL
        AND (ends_at IS NULL OR ends_at > now())
  )
  SELECT count(*)::int, 6, min(ends_at) FROM occupying;
$$;
REVOKE ALL ON FUNCTION public.get_slot_occupancy(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_slot_occupancy(text) TO anon, authenticated;

-- ── Promote the oldest capacity-queued purchase(s) into a position once room frees.
-- Called after anything that can free a slot: expiry, pause, admin reject/delete.
CREATE OR REPLACE FUNCTION public.promote_waitlisted_ads(p_position text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_occupied int;
  v_next record;
BEGIN
  LOOP
    SELECT occupied INTO v_occupied FROM public.get_slot_occupancy(p_position);
    EXIT WHEN v_occupied >= 6;

    SELECT id, duration_days INTO v_next
      FROM public.user_ad_purchases
      WHERE position = p_position AND status = 'pending' AND capacity_wait = true
      ORDER BY created_at ASC
      LIMIT 1;
    EXIT WHEN v_next IS NULL;

    UPDATE public.user_ad_purchases
      SET status = 'approved', capacity_wait = false,
          starts_at = now(), ends_at = now() + (v_next.duration_days || ' days')::interval
      WHERE id = v_next.id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_waitlisted_ads(text) FROM PUBLIC;
-- Not directly callable by clients — only invoked from other SECURITY DEFINER
-- functions (pause/resume/expiry) that have already established a legitimate
-- reason to re-check the queue.

-- ── Pause / resume a user's own live ad. ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pause_user_ad(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_ad_purchases;
BEGIN
  SELECT * INTO v_row FROM public.user_ad_purchases WHERE id = p_id;
  IF v_row IS NULL OR v_row.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not found';
  END IF;
  IF v_row.status != 'approved' OR v_row.paused_at IS NOT NULL THEN
    RAISE EXCEPTION 'This ad is not currently live';
  END IF;

  UPDATE public.user_ad_purchases SET paused_at = now() WHERE id = p_id;
  PERFORM public.promote_waitlisted_ads(v_row.position);
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_user_ad(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_ad_purchases;
  v_occupied int;
BEGIN
  SELECT * INTO v_row FROM public.user_ad_purchases WHERE id = p_id;
  IF v_row IS NULL OR v_row.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not found';
  END IF;
  IF v_row.status != 'approved' OR v_row.paused_at IS NULL THEN
    RAISE EXCEPTION 'This ad is not paused';
  END IF;

  SELECT occupied INTO v_occupied FROM public.get_slot_occupancy(v_row.position);
  IF v_occupied >= 6 THEN
    RAISE EXCEPTION 'This slot is full right now — try resuming again once a spot opens.';
  END IF;

  -- Paused time doesn't count against the paid duration: push ends_at forward by
  -- however long it sat paused.
  UPDATE public.user_ad_purchases
    SET ends_at = ends_at + (now() - paused_at), paused_at = NULL
    WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pause_user_ad(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resume_user_ad(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pause_user_ad(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_user_ad(uuid) TO authenticated;

-- ── Re-check capacity queues whenever the daily expiry sweep runs, so a purchase
-- that's been waiting doesn't sit queued past when a slot actually freed.
CREATE OR REPLACE FUNCTION public.expire_user_ad_purchases()
RETURNS void AS $$
DECLARE
  rec record;
BEGIN
  -- Un-boost any product listings whose boost window has ended.
  UPDATE public.seller_products sp
  SET is_boosted = false
  FROM public.user_ad_purchases uap
  WHERE sp.id = uap.product_id
    AND uap.is_boost = true
    AND uap.status = 'approved'
    AND uap.ends_at IS NOT NULL
    AND uap.ends_at < NOW();

  -- Flip the purchase itself to 'expired' so My Ads / admin reporting reflect it honestly.
  UPDATE public.user_ad_purchases
  SET status = 'expired'
  WHERE status = 'approved'
    AND ends_at IS NOT NULL
    AND ends_at < NOW();

  FOR rec IN SELECT DISTINCT position FROM public.user_ad_purchases WHERE status = 'pending' AND capacity_wait = true LOOP
    PERFORM public.promote_waitlisted_ads(rec.position);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- cron.schedule() upserts by name, so re-running this migration is safe. Mirrors
-- prune-email-logs (plain SELECT of a SECURITY DEFINER function, no pg_net token).
SELECT cron.schedule(
  'prune-page-views',
  '15 4 * * *',
  $$SELECT public.prune_page_views()$$
);


-- ==========================================
-- MIGRATION: 20260718160000_admin_ad_approve_reject_rpcs.sql
-- ==========================================

-- Migration: atomic admin approve/reject RPCs for user_ad_purchases, capacity-aware.
--
-- Previously AdminAds.tsx did approve/reject as plain client-side .update() calls,
-- with two problems this fixes:
--   1. Not atomic: reject did a wallet refund THEN a status update as two separate
--      calls — a failure between them left the user refunded but the ad still
--      'pending'. Now both happen in one transaction.
--   2. Not capacity-aware: approving always set status='approved' regardless of
--      whether that position's rotation slot (max 6, see 20260718150000) already
--      had 6 live ads. Now it checks get_slot_occupancy() inside the same
--      transaction as the state change, so two admins approving near-simultaneously
--      can't both push a slot to 7.
--
-- Boosts (is_boost=true) aren't a rotation slot, so they skip the capacity check
-- entirely, same as they always have.

CREATE OR REPLACE FUNCTION public.admin_approve_user_ad(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_admin boolean;
  v_row public.user_ad_purchases;
  v_occupied int;
  v_ends timestamptz;
BEGIN
  SELECT is_admin INTO v_caller_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_caller_is_admin, false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  SELECT * INTO v_row FROM public.user_ad_purchases WHERE id = p_id;
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Ad purchase not found';
  END IF;

  IF v_row.is_boost THEN
    v_ends := now() + (v_row.duration_days || ' days')::interval;
    UPDATE public.user_ad_purchases
      SET status = 'approved', capacity_wait = false, approved_at = now(), approved_by = auth.uid(),
          starts_at = now(), ends_at = v_ends
      WHERE id = p_id;
    IF v_row.product_id IS NOT NULL THEN
      UPDATE public.seller_products SET is_boosted = true, boost_ends_at = v_ends WHERE id = v_row.product_id;
    END IF;
    RETURN;
  END IF;

  SELECT occupied INTO v_occupied FROM public.get_slot_occupancy(v_row.position);
  IF v_occupied < 6 THEN
    UPDATE public.user_ad_purchases
      SET status = 'approved', capacity_wait = false, approved_at = now(), approved_by = auth.uid(),
          starts_at = now(), ends_at = now() + (v_row.duration_days || ' days')::interval
      WHERE id = p_id;
  ELSE
    -- Content is approved, but the slot is full — queue it. promote_waitlisted_ads
    -- picks it up automatically the moment a spot opens (expiry, pause, or reject).
    UPDATE public.user_ad_purchases
      SET capacity_wait = true, approved_at = now(), approved_by = auth.uid()
      WHERE id = p_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_user_ad(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_admin boolean;
  v_row public.user_ad_purchases;
BEGIN
  SELECT is_admin INTO v_caller_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_caller_is_admin, false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  SELECT * INTO v_row FROM public.user_ad_purchases WHERE id = p_id;
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Ad purchase not found';
  END IF;

  IF v_row.amount_paid > 0 THEN
    PERFORM public.increment_wallet_balance(v_row.user_id, v_row.amount_paid);
    INSERT INTO public.transactions (user_id, type, amount, description)
      VALUES (v_row.user_id, 'deposit', v_row.amount_paid, 'Ad refund: ' || v_row.title);
  END IF;

  UPDATE public.user_ad_purchases
    SET status = 'rejected', rejection_reason = p_reason, capacity_wait = false
    WHERE id = p_id;

  -- If this was a live, slot-occupying ad, rejecting it just freed a spot.
  PERFORM public.promote_waitlisted_ads(v_row.position);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_user_ad(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reject_user_ad(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_user_ad(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_user_ad(uuid, text) TO authenticated;


-- ==========================================
-- MIGRATION: 20260718170000_ad_credits_wallet.sql
-- ==========================================

-- Migration: Ad Credits — a dedicated sub-balance for ad spend.
--
-- Phase 2 of the ads monetization redesign (Phase 1: 20260718150000/160000
-- shipped the capacity/pause system). Per the user's direction: ads should
-- charge from a separate "ad credits" balance, topped up from the main wallet,
-- rather than deducting the main wallet directly on every ad purchase. Per-day
-- pricing is unchanged — this only changes which balance pays for it.
--
-- `transactions` (main wallet ledger) only ever records movements of
-- wallet_balance, never ad_credits_balance — mixing the two would break wallet
-- reconciliation (see payout-and-wallet-flows memory: wallet vs affiliate vs
-- seller balances are already easy to get wrong). The one wallet-side entry
-- this creates is the top-up itself (`transfer_out`); ad credit spend/refund
-- is tracked via user_ad_purchases.amount_paid, not a separate ledger — kept
-- deliberately lean for this phase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ad_credits_balance numeric NOT NULL DEFAULT 0;

-- Move money from the main wallet into ad credits. Owner or admin only,
-- mirrors deduct_wallet's auth check exactly.
CREATE OR REPLACE FUNCTION public.buy_ad_credits(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT wallet_balance INTO cur FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF cur < p_amount THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  UPDATE public.profiles
    SET wallet_balance = wallet_balance - p_amount,
        ad_credits_balance = ad_credits_balance + p_amount
    WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (p_user_id, 'transfer_out', -p_amount, 'Ad credits top-up');
END;
$$;

-- Debit ad credits (ad purchases charge against this instead of wallet_balance).
CREATE OR REPLACE FUNCTION public.deduct_ad_credits(p_user_id uuid, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT ad_credits_balance INTO cur FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF cur < p_amount THEN RAISE EXCEPTION 'Insufficient ad credits balance'; END IF;

  UPDATE public.profiles SET ad_credits_balance = ad_credits_balance - p_amount WHERE id = p_user_id;
  RETURN true;
END;
$$;

-- Credit ad credits back (rejections, future cancellations). Plain increment,
-- no ownership check — mirrors increment_wallet_balance, only ever called from
-- other SECURITY DEFINER functions that have already checked authorization.
CREATE OR REPLACE FUNCTION public.increment_ad_credits(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET ad_credits_balance = COALESCE(ad_credits_balance, 0) + p_amount WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.buy_ad_credits(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_ad_credits(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_ad_credits(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_ad_credits(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_ad_credits(uuid, numeric) TO authenticated;
-- increment_ad_credits is NOT granted directly — only called from other
-- SECURITY DEFINER functions (e.g. admin_reject_user_ad), same as
-- promote_waitlisted_ads in the previous migration.

-- Ad-purchase rejections now refund into ad credits (where the money came
-- from), not the main wallet — same currency in, same currency back.
CREATE OR REPLACE FUNCTION public.admin_reject_user_ad(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_admin boolean;
  v_row public.user_ad_purchases;
BEGIN
  SELECT is_admin INTO v_caller_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_caller_is_admin, false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  SELECT * INTO v_row FROM public.user_ad_purchases WHERE id = p_id;
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Ad purchase not found';
  END IF;

  IF v_row.amount_paid > 0 THEN
    PERFORM public.increment_ad_credits(v_row.user_id, v_row.amount_paid);
  END IF;

  UPDATE public.user_ad_purchases
    SET status = 'rejected', rejection_reason = p_reason, capacity_wait = false
    WHERE id = p_id;

  PERFORM public.promote_waitlisted_ads(v_row.position);
END;
$$;


-- ==========================================
-- MIGRATION: 20260718180000_ad_cpm_cpc_billing.sql
-- ==========================================

-- Migration: CPM/CPC pricing, augmenting (not replacing) flat per-day pricing.
--
-- Phase 3 of the ads redesign, scoped to the 5 rotation slots (header, footer,
-- sidebar, inline, popup) — NOT the separate feature_product_*/feature_store_*
-- boost tiers in ad_pricing, which predate this work and are a different
-- mechanism (is_boost + product_id, unrelated to PromoBanner's rotation pool).
--
-- Model: budget-based, confirmed with the user given the risk of metered
-- billing on the hottest code path in the app (every ad impression/click,
-- sitewide). The buyer pays the FULL budget upfront into ad_credits (same
-- pre-paid pattern as per-day), same as a per_day purchase pays the full
-- price_per_day * duration_days upfront. `spent` accumulates as impressions/
-- clicks land; the ad auto-expires the instant spent reaches budget. No
-- per-event wallet deduction — the money was already collected at purchase
-- time, so there is no way for an impression to bill more than was already
-- paid for. `ends_at` stays NULL for cpm/cpc rows (no calendar end — see
-- get_slot_occupancy, which already treats NULL ends_at as "occupies
-- indefinitely", exactly right here since only the budget bounds it).

ALTER TABLE public.ad_pricing
  ADD COLUMN IF NOT EXISTS billing_model text NOT NULL DEFAULT 'per_day'
    CHECK (billing_model IN ('per_day', 'cpm', 'cpc')),
  ADD COLUMN IF NOT EXISTS cpm_rate numeric,  -- cost per 1000 impressions
  ADD COLUMN IF NOT EXISTS cpc_rate numeric;  -- cost per click

ALTER TABLE public.user_ad_purchases
  ADD COLUMN IF NOT EXISTS billing_model text NOT NULL DEFAULT 'per_day'
    CHECK (billing_model IN ('per_day', 'cpm', 'cpc')),
  ADD COLUMN IF NOT EXISTS budget numeric,        -- cpm/cpc only: total pre-paid budget
  ADD COLUMN IF NOT EXISTS spent numeric NOT NULL DEFAULT 0, -- cpm/cpc only: accrued so far
  ADD COLUMN IF NOT EXISTS cpm_rate numeric,      -- snapshot at purchase time
  ADD COLUMN IF NOT EXISTS cpc_rate numeric;      -- snapshot at purchase time — admin
  -- rate changes shouldn't retroactively change what an active campaign pays.

-- Meters a single impression/click against a cpm/cpc purchase's pre-paid
-- budget. No-op for per_day rows (billed once at purchase, nothing to meter).
-- FOR UPDATE serializes concurrent events on the same ad so two simultaneous
-- page loads can't both read a stale `spent` and double-undercount it.
CREATE OR REPLACE FUNCTION public.bill_metered_ad_event(p_id uuid, p_event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_ad_purchases;
  v_cost numeric;
BEGIN
  SELECT * INTO v_row FROM public.user_ad_purchases WHERE id = p_id AND status = 'approved' FOR UPDATE;
  IF v_row IS NULL OR v_row.billing_model = 'per_day' THEN RETURN; END IF;

  IF p_event = 'impression' AND v_row.billing_model = 'cpm' THEN
    v_cost := COALESCE(v_row.cpm_rate, 0) / 1000;
  ELSIF p_event = 'click' AND v_row.billing_model = 'cpc' THEN
    v_cost := COALESCE(v_row.cpc_rate, 0);
  ELSE
    RETURN; -- e.g. a click on a CPM-billed ad doesn't additionally charge
  END IF;
  IF v_cost <= 0 THEN RETURN; END IF;

  UPDATE public.user_ad_purchases SET spent = spent + v_cost WHERE id = p_id;

  IF v_row.spent + v_cost >= COALESCE(v_row.budget, 0) THEN
    UPDATE public.user_ad_purchases SET status = 'expired' WHERE id = p_id;
    PERFORM public.promote_waitlisted_ads(v_row.position);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.bill_metered_ad_event(uuid, text) FROM PUBLIC;
-- Not directly grantable — only called from increment_ad_impression/click below.

-- Wire metering into the existing impression/click RPCs (20260718120000).
CREATE OR REPLACE FUNCTION public.increment_ad_impression(p_source text, p_ad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_source = 'ads' THEN
    UPDATE public.ads SET impressions = impressions + 1 WHERE id = p_ad_id;
  ELSIF p_source = 'user_ad_purchases' THEN
    UPDATE public.user_ad_purchases SET impressions = impressions + 1 WHERE id = p_ad_id AND status = 'approved';
    PERFORM public.bill_metered_ad_event(p_ad_id, 'impression');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_ad_click(p_source text, p_ad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_source = 'ads' THEN
    UPDATE public.ads SET clicks = clicks + 1 WHERE id = p_ad_id;
  ELSIF p_source = 'user_ad_purchases' THEN
    UPDATE public.user_ad_purchases SET clicks = clicks + 1 WHERE id = p_ad_id AND status = 'approved';
    PERFORM public.bill_metered_ad_event(p_ad_id, 'click');
  END IF;
END;
$$;

-- Rejection refund now returns only the UNSPENT remainder (amount_paid - spent)
-- instead of the full amount — for per_day rows spent is always 0 so this is
-- unchanged; for cpm/cpc rows it correctly keeps whatever already accrued.
CREATE OR REPLACE FUNCTION public.admin_reject_user_ad(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_admin boolean;
  v_row public.user_ad_purchases;
  v_refund numeric;
BEGIN
  SELECT is_admin INTO v_caller_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_caller_is_admin, false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  SELECT * INTO v_row FROM public.user_ad_purchases WHERE id = p_id;
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Ad purchase not found';
  END IF;

  v_refund := GREATEST(COALESCE(v_row.amount_paid, 0) - COALESCE(v_row.spent, 0), 0);
  IF v_refund > 0 THEN
    PERFORM public.increment_ad_credits(v_row.user_id, v_refund);
  END IF;

  UPDATE public.user_ad_purchases
    SET status = 'rejected', rejection_reason = p_reason, capacity_wait = false
    WHERE id = p_id;

  PERFORM public.promote_waitlisted_ads(v_row.position);
END;
$$;


-- ==========================================
-- MIGRATION: 20260718190000_metered_ads_no_calendar_end.sql
-- ==========================================

-- Migration: fix two spots that unconditionally set a calendar ends_at,
-- which would wrongly time-bound a cpm/cpc ad that should only be bounded by
-- its budget (see 20260718180000). Caught by re-reading admin_approve_user_ad
-- and promote_waitlisted_ads after adding metered billing — both compute
-- `now() + duration_days` regardless of billing_model.

CREATE OR REPLACE FUNCTION public.admin_approve_user_ad(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_admin boolean;
  v_row public.user_ad_purchases;
  v_occupied int;
  v_ends timestamptz;
BEGIN
  SELECT is_admin INTO v_caller_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_caller_is_admin, false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  SELECT * INTO v_row FROM public.user_ad_purchases WHERE id = p_id;
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Ad purchase not found';
  END IF;

  IF v_row.is_boost THEN
    v_ends := now() + (v_row.duration_days || ' days')::interval;
    UPDATE public.user_ad_purchases
      SET status = 'approved', capacity_wait = false, approved_at = now(), approved_by = auth.uid(),
          starts_at = now(), ends_at = v_ends
      WHERE id = p_id;
    IF v_row.product_id IS NOT NULL THEN
      UPDATE public.seller_products SET is_boosted = true, boost_ends_at = v_ends WHERE id = v_row.product_id;
    END IF;
    RETURN;
  END IF;

  SELECT occupied INTO v_occupied FROM public.get_slot_occupancy(v_row.position);
  IF v_occupied < 6 THEN
    UPDATE public.user_ad_purchases
      SET status = 'approved', capacity_wait = false, approved_at = now(), approved_by = auth.uid(),
          starts_at = now(),
          ends_at = CASE WHEN v_row.billing_model = 'per_day' THEN now() + (v_row.duration_days || ' days')::interval ELSE NULL END
      WHERE id = p_id;
  ELSE
    -- Content is approved, but the slot is full — queue it. promote_waitlisted_ads
    -- picks it up automatically the moment a spot opens (expiry, pause, or reject).
    UPDATE public.user_ad_purchases
      SET capacity_wait = true, approved_at = now(), approved_by = auth.uid()
      WHERE id = p_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_waitlisted_ads(p_position text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_occupied int;
  v_next record;
BEGIN
  LOOP
    SELECT occupied INTO v_occupied FROM public.get_slot_occupancy(p_position);
    EXIT WHEN v_occupied >= 6;

    SELECT id, duration_days, billing_model INTO v_next
      FROM public.user_ad_purchases
      WHERE position = p_position AND status = 'pending' AND capacity_wait = true
      ORDER BY created_at ASC
      LIMIT 1;
    EXIT WHEN v_next IS NULL;

    UPDATE public.user_ad_purchases
      SET status = 'approved', capacity_wait = false,
          starts_at = now(),
          ends_at = CASE WHEN v_next.billing_model = 'per_day' THEN now() + (v_next.duration_days || ' days')::interval ELSE NULL END
      WHERE id = v_next.id;
  END LOOP;
END;
$$;


-- ==========================================
-- MIGRATION: 20260718200000_fix_admin_delete_user_fk_gaps.sql
-- ==========================================

-- Migration: admin_delete_user was missing several NO ACTION foreign keys,
-- so deleting almost any real user (anyone who'd ever bought something, been
-- moderated, or acted as admin) failed with a raw, unexplained Postgres FK
-- violation. Reproduced directly: deleting a real buyer failed on
-- admin_actions_admin_id_fkey even before reaching marketplace_orders.
--
-- Full audit of every NO ACTION FK pointing at profiles/auth.users (the
-- original migration only handled a subset):
--   admin_actions.admin_id           NOT NULL  -> can't null; delete those log
--                                                 rows (this admin's own log)
--   admin_actions.target_user_id     nullable  -> null out
--   conversations.declined_by/reported_by/assigned_mod/blocked_by
--                                     nullable  -> null out
--   conversations.initiated_by       NOT NULL  -> NOT handled here, deliberately.
--     initiated_by is always one of participant1_id/participant2_id, and those
--     two columns ARE ON DELETE CASCADE (not NO ACTION) — so any row where the
--     target initiated a conversation already gets cascade-deleted via
--     participant1_id/participant2_id before this constraint would matter.
--     True independent violation should be unreachable from real app data.
--   escrow_ledger.to_user_id/from_user_id
--                                     nullable  -> null out (keeps the ledger
--                                                 amount/type row, loses the "who")
--   marketplace_orders.dispute_raised_by
--                                     nullable  -> null out
--   marketplace_orders.buyer_id      NOT NULL  -> genuine judgment call: this is
--     a real seller's sales/revenue record. Silently deleting it destroys the
--     seller's history; silently reassigning it to a placeholder account has its
--     own risks (escrow/payout logic assuming buyer_id resolves meaningfully).
--     Rather than guess, this now blocks with a clear, actionable message
--     instead of a raw constraint error — an admin hitting this needs a human
--     decision (ban instead of delete, or a deliberate follow-up), not a
--     silent data-integrity trade-off made on their behalf.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller           uuid := auth.uid();
  v_caller_is_admin  boolean;
  v_caller_is_founder boolean;
  v_target_exists    boolean;
  v_target_is_founder boolean;
  v_order_count      int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_admin, COALESCE(is_founder, false)
    INTO v_caller_is_admin, v_caller_is_founder
    FROM public.profiles WHERE id = v_caller;

  IF NOT COALESCE(v_caller_is_admin, false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  IF p_target_id = v_caller THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  SELECT true, COALESCE(is_founder, false)
    INTO v_target_exists, v_target_is_founder
    FROM public.profiles WHERE id = p_target_id;

  IF NOT COALESCE(v_target_exists, false) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target_is_founder AND NOT v_caller_is_founder THEN
    RAISE EXCEPTION 'Only a founder can delete a founder account';
  END IF;

  SELECT count(*) INTO v_order_count FROM public.marketplace_orders WHERE buyer_id = p_target_id;
  IF v_order_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: this user has % marketplace order(s) as a buyer, which must be preserved for the seller''s records. Ban or suspend the account instead of deleting it.', v_order_count;
  END IF;

  -- Remove the user's own rows in NO ACTION tables (these would block the delete).
  DELETE FROM public.activity_logs            WHERE user_id     = p_target_id;
  DELETE FROM public.auto_renewals            WHERE user_id     = p_target_id;
  DELETE FROM public.verification_applications WHERE user_id    = p_target_id;
  DELETE FROM public.seller_reviews           WHERE reviewer_id = p_target_id; -- reviewer_id is NOT NULL
  DELETE FROM public.admin_actions            WHERE admin_id    = p_target_id; -- admin_id is NOT NULL

  -- Null out references where this user was merely the acting admin/moderator on
  -- someone else's record (all nullable columns).
  UPDATE public.verification_applications SET reviewed_by        = NULL WHERE reviewed_by        = p_target_id;
  UPDATE public.marketplace_orders        SET dispute_resolved_by = NULL WHERE dispute_resolved_by = p_target_id;
  UPDATE public.marketplace_orders        SET dispute_raised_by  = NULL WHERE dispute_raised_by  = p_target_id;
  UPDATE public.seller_email_blasts       SET initiated_by       = NULL WHERE initiated_by       = p_target_id;
  UPDATE public.seller_products           SET approved_by        = NULL WHERE approved_by        = p_target_id;
  UPDATE public.sellers                   SET approved_by        = NULL WHERE approved_by        = p_target_id;
  UPDATE public.admin_actions             SET target_user_id     = NULL WHERE target_user_id     = p_target_id;
  UPDATE public.conversations             SET declined_by        = NULL WHERE declined_by        = p_target_id;
  UPDATE public.conversations             SET reported_by        = NULL WHERE reported_by        = p_target_id;
  UPDATE public.conversations             SET assigned_mod       = NULL WHERE assigned_mod       = p_target_id;
  UPDATE public.conversations             SET blocked_by         = NULL WHERE blocked_by         = p_target_id;
  UPDATE public.escrow_ledger             SET to_user_id         = NULL WHERE to_user_id         = p_target_id;
  UPDATE public.escrow_ledger             SET from_user_id       = NULL WHERE from_user_id       = p_target_id;

  -- Delete the auth user; profiles + all CASCADE/SET NULL children follow.
  DELETE FROM auth.users WHERE id = p_target_id;
END;
$$;


-- ==========================================
-- MIGRATION: 20260718210000_product_requests.sql
-- ==========================================

-- Migration: internal product requests + notify-on-add.
--
-- Replaces the old "Request a Product → WhatsApp" flow with a first-class,
-- in-app record. A shopper can ask for a product that isn't in the catalogue
-- yet and optionally opt in to be notified when an admin adds it. Admins see
-- and action these from Catalog → Requests.
--
-- Deliberately no FK on fulfilled_product_id: the platform catalogue lives in
-- `products` (bigint id) while marketplace listings live in `seller_products`
-- (uuid id); a request can be fulfilled by either, so the link is stored
-- informationally rather than constrained to one table.

CREATE TABLE IF NOT EXISTS public.product_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_name         text NOT NULL,
  category             text,
  details              text,
  notify_on_add        boolean NOT NULL DEFAULT false,
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'fulfilled', 'declined')),
  fulfilled_product_id text,
  conversation_id      uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  notified_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  fulfilled_at         timestamptz
);

CREATE INDEX IF NOT EXISTS product_requests_status_idx ON public.product_requests (status);
CREATE INDEX IF NOT EXISTS product_requests_user_idx   ON public.product_requests (user_id);
CREATE INDEX IF NOT EXISTS product_requests_notify_idx ON public.product_requests (notify_on_add) WHERE notify_on_add = true;

ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;

-- A signed-in user can file a request for themselves.
DROP POLICY IF EXISTS product_requests_insert_own ON public.product_requests;
CREATE POLICY product_requests_insert_own ON public.product_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users read their own requests; admins read all.
DROP POLICY IF EXISTS product_requests_select_own_or_admin ON public.product_requests;
CREATE POLICY product_requests_select_own_or_admin ON public.product_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- Only admins update (mark fulfilled/declined, link a product, stamp notified_at).
DROP POLICY IF EXISTS product_requests_admin_update ON public.product_requests;
CREATE POLICY product_requests_admin_update ON public.product_requests
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only admins delete.
DROP POLICY IF EXISTS product_requests_admin_delete ON public.product_requests;
CREATE POLICY product_requests_admin_delete ON public.product_requests
  FOR DELETE TO authenticated
  USING (is_admin());

-- Admin master switch for the notify-on-add feature (default ON). Lives on the
-- existing singleton settings row so it reads with the other toggles.
ALTER TABLE public.marketplace_settings
  ADD COLUMN IF NOT EXISTS product_requests_notify_enabled boolean NOT NULL DEFAULT true;


-- ==========================================
-- MIGRATION: 20260718220000_abandoned_checkouts.sql
-- ==========================================

-- Migration: Abandoned Cart/Purchase Reminders (Shopify-style)
--
-- Tracks checkout sessions, detects when users drop off, and sends a styled
-- recovery email after 30 minutes containing a direct recovery URL.

CREATE TABLE IF NOT EXISTS public.abandoned_checkouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id       text NOT NULL, -- stores either bigint product.id or UUID seller_product.id
  plan_name        text NOT NULL,
  price            numeric NOT NULL,
  status           text NOT NULL DEFAULT 'initiated'
                     CHECK (status IN ('initiated', 'completed', 'recovered')),
  coupon_code      text,
  client_reference text NOT NULL UNIQUE,
  -- true when this session was created after the shopper clicked a recovery
  -- email link; lets the completion trigger tell a recovered sale apart from
  -- an ordinary one instead of guessing from status alone.
  via_recovery     boolean NOT NULL DEFAULT false,
  email_sent_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  recovered_at     timestamptz
);

CREATE INDEX IF NOT EXISTS abandoned_checkouts_status_idx ON public.abandoned_checkouts (status);
CREATE INDEX IF NOT EXISTS abandoned_checkouts_user_idx   ON public.abandoned_checkouts (user_id);
CREATE INDEX IF NOT EXISTS abandoned_checkouts_client_ref_idx ON public.abandoned_checkouts (client_reference);

ALTER TABLE public.abandoned_checkouts ENABLE ROW LEVEL SECURITY;

-- Signed-in users can insert and update their own checkout sessions.
DROP POLICY IF EXISTS abandoned_checkouts_insert_own ON public.abandoned_checkouts;
CREATE POLICY abandoned_checkouts_insert_own ON public.abandoned_checkouts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS abandoned_checkouts_update_own ON public.abandoned_checkouts;
CREATE POLICY abandoned_checkouts_update_own ON public.abandoned_checkouts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- Users read their own checkout sessions; admins read all.
DROP POLICY IF EXISTS abandoned_checkouts_select_own_or_admin ON public.abandoned_checkouts;
CREATE POLICY abandoned_checkouts_select_own_or_admin ON public.abandoned_checkouts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- Only admins delete checkout sessions.
DROP POLICY IF EXISTS abandoned_checkouts_admin_delete ON public.abandoned_checkouts;
CREATE POLICY abandoned_checkouts_admin_delete ON public.abandoned_checkouts
  FOR DELETE TO authenticated
  USING (is_admin());

-- Add toggles to marketplace_settings
ALTER TABLE public.marketplace_settings
  ADD COLUMN IF NOT EXISTS abandoned_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_on_abandoned_reminder boolean NOT NULL DEFAULT true;


-- ── Order Completion Trigger (Platform Orders) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_order_completion_for_checkout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.abandoned_checkouts
  SET status = CASE WHEN via_recovery THEN 'recovered' ELSE 'completed' END,
      recovered_at = CASE WHEN via_recovery THEN now() ELSE recovered_at END,
      updated_at = now()
  WHERE client_reference = NEW.client_reference
    AND status = 'initiated';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_completion_for_checkout ON public.orders;
CREATE TRIGGER trg_order_completion_for_checkout
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_completion_for_checkout();


-- ── Order Completion Trigger (Marketplace Orders) ───────────────────────────
CREATE OR REPLACE FUNCTION public.handle_marketplace_order_completion_for_checkout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.abandoned_checkouts
  SET status = CASE WHEN via_recovery THEN 'recovered' ELSE 'completed' END,
      recovered_at = CASE WHEN via_recovery THEN now() ELSE recovered_at END,
      updated_at = now()
  WHERE user_id = NEW.buyer_id
    AND product_id = NEW.product_id::text
    AND status = 'initiated';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_order_completion_for_checkout ON public.marketplace_orders;
CREATE TRIGGER trg_marketplace_order_completion_for_checkout
  AFTER INSERT ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_marketplace_order_completion_for_checkout();


-- ── Background Cron Processor to Send Emails ────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_abandoned_checkout_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
  v_anon_key text := 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZWpyb210Z2RmeXNtdnBtYnZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDU2NDQsImV4cCI6MjA5NDU4MTY0NH0.OTXsJ9H6AdiFv0LdxtDGwG0hiXlIXCPe4AlrI75WhUo';
  v_enabled boolean;
  v_email_enabled boolean;
  v_product_name text;
  v_recovery_url text;
  v_email_html text;
  v_email_subject text;
BEGIN
  -- Check master settings
  SELECT abandoned_reminders_enabled, email_on_abandoned_reminder
  INTO v_enabled, v_email_enabled
  FROM public.marketplace_settings
  LIMIT 1;

  IF v_enabled = false OR v_email_enabled = false THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT
      ac.id,
      ac.user_id,
      ac.product_id,
      ac.plan_name,
      ac.price,
      ac.coupon_code,
      p.email as user_email,
      p.name as user_name
    FROM public.abandoned_checkouts ac
    JOIN public.profiles p ON p.id = ac.user_id
    WHERE ac.status = 'initiated'
      AND ac.email_sent_at IS NULL
      AND ac.created_at < now() - interval '30 minutes'
      AND ac.created_at > now() - interval '24 hours'
  LOOP
    -- Retrieve product name depending on table
    IF rec.product_id ~ '^[0-9]+$' THEN
      SELECT name INTO v_product_name FROM public.products WHERE id = rec.product_id::bigint;
    ELSE
      SELECT title INTO v_product_name FROM public.seller_products WHERE id = rec.product_id::uuid;
    END IF;

    IF v_product_name IS NULL THEN
      v_product_name := 'your selected product';
    END IF;

    v_email_subject := '🛒 You left something behind!';
    v_recovery_url := 'https://subskription.com.ng/checkout?recover=' || rec.id::text;

    v_email_html := '<p>Hello ' || COALESCE(rec.user_name, 'there') || ',</p>' ||
                    '<p>We noticed you started checking out for <strong>' || v_product_name || '</strong> (' || rec.plan_name || ') but didn''t complete your purchase.</p>' ||
                    '<p>Don''t worry, we''ve saved your spot! You can complete your order now using the link below:</p>' ||
                    '<p><a href="' || v_recovery_url || '" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;">Complete Your Purchase</a></p>' ||
                    '<p>If you have any questions or need help, feel free to contact our support team in the app.</p>';

    -- Dispatch to send-email function
    PERFORM net.http_post(
      url := 'https://lwejromtgdfysmvpmbvx.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', v_anon_key
      ),
      body := jsonb_build_object(
        'to', rec.user_email,
        'subject', v_email_subject,
        'html', v_email_html,
        'event', 'abandoned_reminder'
      )
    );

    -- Mark reminder email as sent
    UPDATE public.abandoned_checkouts
    SET email_sent_at = now(), updated_at = now()
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Schedule job with pg_cron
SELECT cron.unschedule('send-abandoned-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-abandoned-reminders'
);

SELECT cron.schedule(
  'send-abandoned-reminders',
  '*/15 * * * *',
  $$SELECT public.send_abandoned_checkout_reminders()$$
);


-- ==========================================
-- MIGRATION: 20260719120000_notify_admins_on_product_request.sql
-- ==========================================

-- Notify admins when a shopper files a new product request.
--
-- product_requests rows were being inserted fine (Catalog → Requests showed
-- them), but nothing ever told an admin it had happened — the bell never
-- rang. Mirrors notify_admins_on_pending_seller().

create or replace function public.notify_admins_on_product_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_requester text;
begin
  select coalesce(nullif(p.name, ''), p.email, 'A user')
    into v_requester
    from public.profiles p
   where p.id = NEW.user_id;

  for v_admin_id in select id from public.profiles where is_admin = true
  loop
    if v_admin_id is distinct from NEW.user_id then
      insert into public.notifications (user_id, title, message, type, link)
      values (
        v_admin_id,
        'New product request',
        coalesce(v_requester, 'A user') || ' requested "' || NEW.product_name || '".',
        'Update',
        '/admin/products/requests'
      );
    end if;
  end loop;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_admins_on_product_request on public.product_requests;
create trigger trg_notify_admins_on_product_request
  after insert on public.product_requests
  for each row execute function public.notify_admins_on_product_request();


-- ==========================================
-- MIGRATION: 20260719130000_admin_run_pending_tx_cleanup.sql
-- ==========================================

-- Let an admin trigger the stale-pending-transaction cleanup on demand from
-- the System Health "Quick Fix" panel, instead of waiting for the 5-minute
-- cron (cron_auto_cancel.sql). cancel_stale_pending_transactions() itself is
-- granted to service_role only — this wraps it with an is_admin() check and
-- grants to authenticated, so the client can call it directly and safely.

create or replace function public.admin_run_pending_tx_cleanup(older_than_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;

  select count(*) into v_count
  from public.cancel_stale_pending_transactions(older_than_minutes);

  return v_count;
end;
$$;

grant execute on function public.admin_run_pending_tx_cleanup(integer) to authenticated;


-- ==========================================
-- MIGRATION: 20260719140000_auto_approve_ads_setting.sql
-- ==========================================

-- Ads were silently auto-approving because AdvertisePage.tsx reused the
-- PRODUCT auto-approve settings (sellers.auto_approve_products /
-- marketplace_settings.auto_approve_products) to decide whether a paid ad
-- placement goes live immediately or waits for review. Those settings exist
-- for catalog listings, not ad spend — an admin turning on "auto-approve
-- product listings" never meant to also skip review on paid ad banners.
--
-- Dedicated, ads-only switch. Defaults to false (manual review) since that's
-- the behavior the admin actually wants, not the accidental current default.
alter table public.marketplace_settings
  add column if not exists auto_approve_ads boolean not null default false;


-- ==========================================
-- MIGRATION: 20260719150000_notify_admins_on_pending_ad.sql
-- ==========================================

-- Alert admins when an ad purchase actually needs manual review.
--
-- Mirrors notify_admins_on_product_request(). Only fires for genuine
-- manual-review-required rows: status='pending' AND capacity_wait=false.
-- Capacity-queued rows (auto-approved but the slot was full) are also
-- inserted with status='pending' but need no admin action — they'll
-- self-promote via promote_waitlisted_ads() the moment a slot frees, so
-- alerting on those would just be noise.

create or replace function public.notify_admins_on_pending_ad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_buyer text;
begin
  if NEW.status <> 'pending' or NEW.capacity_wait then
    return NEW;
  end if;

  select coalesce(nullif(p.name, ''), p.email, 'A user')
    into v_buyer
    from public.profiles p
   where p.id = NEW.user_id;

  for v_admin_id in select id from public.profiles where is_admin = true
  loop
    if v_admin_id is distinct from NEW.user_id then
      insert into public.notifications (user_id, title, message, type, link)
      values (
        v_admin_id,
        'Ad awaiting approval',
        coalesce(v_buyer, 'A user') || ' submitted "' || NEW.title || '" (' || NEW.position || ') for review.',
        'Update',
        '/admin/ads?tab=user-ads'
      );
    end if;
  end loop;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_admins_on_pending_ad on public.user_ad_purchases;
create trigger trg_notify_admins_on_pending_ad
  after insert on public.user_ad_purchases
  for each row execute function public.notify_admins_on_pending_ad();
