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
