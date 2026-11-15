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
