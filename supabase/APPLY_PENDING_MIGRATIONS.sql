-- Paste this whole file into the Supabase SQL editor and run it once.
-- It contains, in order: 20261115030000_platform_admin_controls, 20261115040000_reports_scheduling_ad_stats.
-- Safe to run more than once. (Earlier migrations, including the payment method and Subskription sign-in ones, are already applied.)

-- Platform admin controls for developa.me
-- Per-site status and restrictions, per-account status, announcements, an audit trail, and plan targeting for
-- platform ads. Everything here is server-only (RLS on, no policies): the app reads and writes it with the
-- service role from admin-checked API routes. Purely additive; safe to run more than once.

-- 1. What the platform has decided about a site
CREATE TABLE IF NOT EXISTS public.site_admin_state (
  site_id uuid PRIMARY KEY REFERENCES public.forums(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'suspended', 'banned')),
  -- Switches such as {"no_online_payments":true,"no_newsletters":true,"no_custom_domain":true,"no_new_products":true,"hide_from_directory":true,"product_cap":5}
  restrictions jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT '',          -- shown to the owner
  admin_note text NOT NULL DEFAULT '',      -- private to admins
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_admin_state ENABLE ROW LEVEL SECURITY;

-- 2. What the platform has decided about a person (their account)
CREATE TABLE IF NOT EXISTS public.user_admin_state (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'banned')),
  max_sites_override integer,               -- NULL means use the plan's limit
  reason text NOT NULL DEFAULT '',
  admin_note text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_admin_state ENABLE ROW LEVEL SECURITY;

-- 3. Announcements to site owners (shown in their dashboard inbox; optional bell and email are sent when created)
CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'success', 'warning', 'critical')),
  -- {"type":"all"} | {"type":"tiers","tiers":["free","lite"]} | {"type":"sites","site_ids":["..."]} | {"type":"status","status":"restricted"}
  audience jsonb NOT NULL DEFAULT '{"type":"all"}'::jsonb,
  channels text[] NOT NULL DEFAULT ARRAY['inbox']::text[],
  pinned boolean NOT NULL DEFAULT false,    -- stays on top of the owner's dashboard until it expires
  expires_at timestamptz,
  recipient_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS platform_announcements_created_idx ON public.platform_announcements (created_at DESC);

-- 4. Who did what
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  admin_email text,
  action text NOT NULL,
  target_type text NOT NULL DEFAULT 'site',
  target_id text,
  site_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_site_idx ON public.admin_audit_log (site_id);

-- 5. Platform ads can be aimed at plans (default: Starter only, as before) and count impressions
DO $$
BEGIN
  IF to_regclass('public.platform_site_ads') IS NOT NULL THEN
    ALTER TABLE public.platform_site_ads ADD COLUMN IF NOT EXISTS target_tiers text[] NOT NULL DEFAULT ARRAY['free']::text[];
    ALTER TABLE public.platform_site_ads ADD COLUMN IF NOT EXISTS impressions integer NOT NULL DEFAULT 0;
    ALTER TABLE public.platform_site_ads ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0;
  END IF;
END $$;


-- Reports from the public, content removed by the platform, scheduled announcements, and ad counters.
-- Run after 20261115030000_platform_admin_controls.sql. Purely additive; safe to run more than once.
-- Everything here is server-only (RLS on, no policies): the app uses the service role from checked routes.

-- 1. Reports from buyers and visitors ("this store is a scam", "this product is illegal", ...)
CREATE TABLE IF NOT EXISTS public.site_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.forums(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'site' CHECK (target_type IN ('site', 'product', 'thread')),
  target_id uuid,
  reason text NOT NULL CHECK (reason IN ('scam', 'counterfeit', 'illegal', 'abuse', 'spam', 'other')),
  details text NOT NULL DEFAULT '',
  reporter_email text NOT NULL DEFAULT '',
  reporter_id uuid,
  reporter_key text NOT NULL DEFAULT '',       -- a hash, never the raw address; used to stop repeat reports
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  resolution text NOT NULL DEFAULT '',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS site_reports_status_idx ON public.site_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS site_reports_site_idx ON public.site_reports (site_id);

-- 2. Items (products or posts) the platform has taken down. The owner cannot switch them back on.
CREATE TABLE IF NOT EXISTS public.site_moderation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.forums(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('product', 'thread')),
  item_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  removed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_type, item_id)
);
ALTER TABLE public.site_moderation ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS site_moderation_site_idx ON public.site_moderation (site_id);

-- 3. Announcements can be scheduled for later
ALTER TABLE public.platform_announcements ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent';
ALTER TABLE public.platform_announcements ADD COLUMN IF NOT EXISTS send_at timestamptz;
ALTER TABLE public.platform_announcements ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.platform_announcements ADD COLUMN IF NOT EXISTS bell_sent integer NOT NULL DEFAULT 0;
ALTER TABLE public.platform_announcements ADD COLUMN IF NOT EXISTS emailed integer NOT NULL DEFAULT 0;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_announcements_status_check') THEN
    ALTER TABLE public.platform_announcements ADD CONSTRAINT platform_announcements_status_check CHECK (status IN ('scheduled', 'sent', 'cancelled'));
  END IF;
END $$;
UPDATE public.platform_announcements SET sent_at = created_at WHERE sent_at IS NULL AND status = 'sent';
CREATE INDEX IF NOT EXISTS platform_announcements_due_idx ON public.platform_announcements (send_at) WHERE status = 'scheduled';

-- 4. Count ad views and clicks safely (one atomic update, callable only by the server)
CREATE OR REPLACE FUNCTION public.bump_platform_ad(p_ad uuid, p_kind text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.platform_site_ads
     SET impressions = impressions + CASE WHEN p_kind = 'impression' THEN 1 ELSE 0 END,
         clicks = clicks + CASE WHEN p_kind = 'click' THEN 1 ELSE 0 END
   WHERE id = p_ad;
$$;
REVOKE ALL ON FUNCTION public.bump_platform_ad(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_platform_ad(uuid, text) TO service_role;
