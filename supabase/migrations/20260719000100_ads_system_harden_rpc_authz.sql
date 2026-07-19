-- Harden ad RPCs: enforce admin-only / owner-only checks server-side, revoke anon execute.
-- The initial ads_system_schema.sql RPCs had no internal auth checks, so any anon/authenticated
-- caller could approve/reject/resume ads or insert purchases under any user_id.

CREATE OR REPLACE FUNCTION public.approve_user_ad(p_id UUID)
RETURNS VOID AS $$
DECLARE
  v_dur INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT duration_days INTO v_dur FROM public.user_ad_purchases WHERE id = p_id;
  UPDATE public.user_ad_purchases
  SET status = 'approved',
      starts_at = now(),
      ends_at = now() + (COALESCE(v_dur, 7) || ' days')::INTERVAL,
      rejection_reason = NULL
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reject_user_ad(p_id UUID, p_reason TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.user_ad_purchases
  SET status = 'rejected', rejection_reason = p_reason
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resume_user_ad(p_id UUID)
RETURNS VOID AS $$
DECLARE
  v_paused TIMESTAMPTZ;
  v_ends TIMESTAMPTZ;
  v_diff INTERVAL;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_ad_purchases
    WHERE id = p_id AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT paused_at, ends_at INTO v_paused, v_ends FROM public.user_ad_purchases WHERE id = p_id;
  IF v_paused IS NOT NULL AND v_ends IS NOT NULL THEN
    v_diff := now() - v_paused;
    UPDATE public.user_ad_purchases
    SET paused_at = NULL, ends_at = v_ends + v_diff
    WHERE id = p_id;
  ELSE
    UPDATE public.user_ad_purchases SET paused_at = NULL WHERE id = p_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.purchase_ad_placements(p_user_id UUID, p_rows JSONB)
RETURNS VOID AS $$
DECLARE
  r RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR r IN SELECT * FROM jsonb_to_recordset(p_rows) AS x(
    title TEXT, image_url TEXT, image_mobile_url TEXT, link_url TEXT, cta_text TEXT,
    position TEXT, pages JSONB, duration_days INT, amount_paid NUMERIC, status TEXT,
    capacity_wait BOOLEAN, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, billing_model TEXT,
    budget NUMERIC, cpm_rate NUMERIC, cpc_rate NUMERIC, is_boost BOOLEAN, product_id TEXT
  ) LOOP
    INSERT INTO public.user_ad_purchases (
      user_id, title, image_url, image_mobile_url, link_url, cta_text, position, pages,
      duration_days, amount_paid, status, capacity_wait, starts_at, ends_at, billing_model,
      budget, cpm_rate, cpc_rate, is_boost, product_id
    ) VALUES (
      p_user_id, r.title, r.image_url, r.image_mobile_url, r.link_url, r.cta_text, r.position, COALESCE(r.pages, '["all"]'::jsonb),
      r.duration_days, r.amount_paid, COALESCE(r.status, 'pending'), COALESCE(r.capacity_wait, false), r.starts_at, r.ends_at, COALESCE(r.billing_model, 'per_day'),
      r.budget, r.cpm_rate, r.cpc_rate, COALESCE(r.is_boost, false), r.product_id
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.approve_user_ad(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_user_ad(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resume_user_ad(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pause_user_ad(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.purchase_ad_placements(UUID, JSONB) FROM anon;
