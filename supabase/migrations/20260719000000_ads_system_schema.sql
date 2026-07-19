-- ==============================================================================
-- ADS SYSTEM SCHEMA & MIGRATION SCRIPT FOR YOUR RESEARCH WRITER
-- ==============================================================================

-- 1. Admin System Banners Table (Curated System Ads)
CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT,
  image_mobile_url TEXT,
  link_url TEXT,
  cta_text TEXT DEFAULT 'Learn More',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  position TEXT NOT NULL DEFAULT 'header', -- 'header', 'footer', 'sidebar', 'inline', 'popup'
  pages JSONB NOT NULL DEFAULT '["all"]'::jsonb,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_dismissible BOOLEAN NOT NULL DEFAULT false,
  autoplay_speed INT NOT NULL DEFAULT 5,
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. User Self-Serve Paid Ads Table
CREATE TABLE IF NOT EXISTS public.user_ad_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT,
  image_mobile_url TEXT,
  link_url TEXT,
  cta_text TEXT DEFAULT 'Learn More',
  position TEXT NOT NULL, -- 'header', 'footer', 'sidebar', 'inline', 'popup'
  pages JSONB NOT NULL DEFAULT '["all"]'::jsonb,
  duration_days INT NOT NULL DEFAULT 7,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired', 'paused', 'queued'
  rejection_reason TEXT,
  capacity_wait BOOLEAN NOT NULL DEFAULT false,
  paused_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  conversions INT NOT NULL DEFAULT 0,
  billing_model TEXT NOT NULL DEFAULT 'per_day', -- 'per_day', 'metered'
  budget NUMERIC,
  spent NUMERIC NOT NULL DEFAULT 0,
  cpm_rate NUMERIC,
  cpc_rate NUMERIC,
  is_boost BOOLEAN NOT NULL DEFAULT false,
  product_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Ad Pricing & Placement Configuration Table
CREATE TABLE IF NOT EXISTS public.ad_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  price_per_day NUMERIC NOT NULL DEFAULT 1000,
  boost_price_per_day NUMERIC NOT NULL DEFAULT 1500,
  min_days INT NOT NULL DEFAULT 3,
  max_days INT NOT NULL DEFAULT 90,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  billing_model TEXT NOT NULL DEFAULT 'per_day', -- 'per_day', 'metered'
  cpm_rate NUMERIC DEFAULT 0,
  cpc_rate NUMERIC DEFAULT 0,
  slot_cap INT NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Marketplace Settings / Global Auto-Approve Toggle
CREATE TABLE IF NOT EXISTS public.marketplace_settings (
  id INT PRIMARY KEY DEFAULT 1,
  auto_approve_ads BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Ad credits balance on profiles (used by advertise page as a fallback to wallet)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ad_credits_balance NUMERIC NOT NULL DEFAULT 0;

-- Seed initial default pricing tiers if not exists
INSERT INTO public.ad_pricing (position, label, price_per_day, boost_price_per_day, min_days, max_days, description, slot_cap)
VALUES 
  ('header',  'Header Banner (Top Page)', 2500, 3000, 3, 90, 'High visibility banner at the top of every page', 6),
  ('footer',  'Footer Banner (Bottom)', 1200, 1500, 3, 90, 'Clean bottom banner across pages', 6),
  ('sidebar', 'Sidebar Banner Card', 1800, 2000, 3, 90, 'Sitewide sticky sidebar card placement', 4),
  ('inline',  'Inline Sponsored Text Line', 1000, 1200, 3, 90, 'Native text-only sponsored line embedded in feeds', 8),
  ('popup',   'Modal Overlay Popup', 3500, 4000, 1, 30, 'High conversion modal overlay shown to active visitors', 2)
ON CONFLICT (position) DO NOTHING;

INSERT INTO public.marketplace_settings (id, auto_approve_ads)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- RLS Security Policies
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ad_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;

-- Public read access for active ads and pricing
CREATE POLICY "Public read ads" ON public.ads FOR SELECT USING (true);
CREATE POLICY "Public read user_ad_purchases" ON public.user_ad_purchases FOR SELECT USING (status = 'approved');
CREATE POLICY "Public read ad_pricing" ON public.ad_pricing FOR SELECT USING (true);
CREATE POLICY "Public read marketplace_settings" ON public.marketplace_settings FOR SELECT USING (true);

-- User manage own purchases
CREATE POLICY "Users view own purchases" ON public.user_ad_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own purchases" ON public.user_ad_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins manage ads" ON public.ads FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins manage user_ad_purchases" ON public.user_ad_purchases FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins manage ad_pricing" ON public.ad_pricing FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins manage marketplace_settings" ON public.marketplace_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ==============================================================================
-- STORED PROCEDURES / RPCS
-- ==============================================================================

-- 1. Atomic Impression Increment
CREATE OR REPLACE FUNCTION public.increment_ad_impression(p_source TEXT, p_ad_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_source = 'ads' THEN
    UPDATE public.ads SET impressions = impressions + 1 WHERE id = p_ad_id;
  ELSIF p_source = 'user_ad_purchases' THEN
    UPDATE public.user_ad_purchases SET impressions = impressions + 1 WHERE id = p_ad_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Atomic Click Increment
CREATE OR REPLACE FUNCTION public.increment_ad_click(p_source TEXT, p_ad_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_source = 'ads' THEN
    UPDATE public.ads SET clicks = clicks + 1 WHERE id = p_ad_id;
  ELSIF p_source = 'user_ad_purchases' THEN
    UPDATE public.user_ad_purchases SET clicks = clicks + 1 WHERE id = p_ad_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Get Slot Occupancy
CREATE OR REPLACE FUNCTION public.get_slot_occupancy(p_position TEXT)
RETURNS TABLE (occupied INT, slot_cap INT, next_free_at TIMESTAMPTZ) AS $$
DECLARE
  v_cap INT;
  v_occ INT;
  v_next TIMESTAMPTZ;
BEGIN
  SELECT ap.slot_cap INTO v_cap FROM public.ad_pricing ap WHERE ap.position = p_position;
  IF v_cap IS NULL THEN v_cap := 6; END IF;

  SELECT COUNT(*)::INT INTO v_occ
  FROM public.user_ad_purchases
  WHERE position = p_position
    AND status = 'approved'
    AND paused_at IS NULL
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now());

  SELECT MIN(ends_at) INTO v_next
  FROM public.user_ad_purchases
  WHERE position = p_position
    AND status = 'approved'
    AND paused_at IS NULL
    AND ends_at > now();

  RETURN QUERY SELECT v_occ, v_cap, v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Purchase Ad Placements RPC
CREATE OR REPLACE FUNCTION public.purchase_ad_placements(p_user_id UUID, p_rows JSONB)
RETURNS VOID AS $$
DECLARE
  r RECORD;
  v_total NUMERIC := 0;
BEGIN
  -- Calculate total amount
  FOR r IN SELECT * FROM jsonb_to_recordset(p_rows) AS x(amount_paid NUMERIC) LOOP
    v_total := v_total + COALESCE(r.amount_paid, 0);
  END LOOP;

  -- Insert purchases
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

-- 5. Pause User Ad
CREATE OR REPLACE FUNCTION public.pause_user_ad(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_ad_purchases
  SET paused_at = now()
  WHERE id = p_id AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Resume User Ad
CREATE OR REPLACE FUNCTION public.resume_user_ad(p_id UUID)
RETURNS VOID AS $$
DECLARE
  v_paused TIMESTAMPTZ;
  v_ends TIMESTAMPTZ;
  v_diff INTERVAL;
BEGIN
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

-- 7. Approve User Ad
CREATE OR REPLACE FUNCTION public.approve_user_ad(p_id UUID)
RETURNS VOID AS $$
DECLARE
  v_dur INT;
BEGIN
  SELECT duration_days INTO v_dur FROM public.user_ad_purchases WHERE id = p_id;
  UPDATE public.user_ad_purchases
  SET status = 'approved',
      starts_at = now(),
      ends_at = now() + (COALESCE(v_dur, 7) || ' days')::INTERVAL,
      rejection_reason = NULL
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Reject User Ad
CREATE OR REPLACE FUNCTION public.reject_user_ad(p_id UUID, p_reason TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_ad_purchases
  SET status = 'rejected', rejection_reason = p_reason
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
