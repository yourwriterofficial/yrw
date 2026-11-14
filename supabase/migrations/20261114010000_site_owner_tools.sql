-- Owner tools and founder controls for developa.me sites.
-- Adds: plan expiry, DNS-verified custom domains, an announcement bar, discount coupons,
-- a plan payments ledger, and platform ads the founder can show on every site.
-- Safe to re-run.

-- 1. Site columns -------------------------------------------------------------------------
alter table public.forums
  add column if not exists plan_expires_at timestamptz,
  add column if not exists domain_verify_token text,
  add column if not exists domain_checked_at timestamptz,
  add column if not exists announcement text not null default '',
  add column if not exists announcement_active boolean not null default false;

-- A domain only routes to a site once its DNS ownership is proven.
create or replace function public.resolve_site_by_domain(p_host text)
returns table (id uuid, slug text, custom_domain text, site_mode text, is_public boolean)
language sql
security definer
set search_path = public
as $$
  select id, slug, custom_domain, site_mode, is_public
  from public.forums
  where custom_domain = lower(trim(p_host)) and custom_domain_verified = true
  limit 1;
$$;

-- 2. Discount coupons (Pro plans) ----------------------------------------------------------
create table if not exists public.site_coupons (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.forums (id) on delete cascade,
  code        text not null,
  kind        text not null check (kind in ('percent', 'fixed')),
  amount      numeric(12, 2) not null check (amount > 0),
  max_uses    integer check (max_uses is null or max_uses > 0),
  used_count  integer not null default 0,
  expires_at  timestamptz,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (site_id, code)
);
create index if not exists site_coupons_site_idx on public.site_coupons (site_id);
alter table public.site_coupons enable row level security;   -- served only through the server

alter table public.site_orders
  add column if not exists coupon_code text,
  add column if not exists discount_amount numeric(12, 2) not null default 0;

-- 3. Plan payments ledger (founder records what each site paid) ---------------------------
create table if not exists public.site_plan_payments (
  id          bigint generated always as identity primary key,
  site_id     uuid not null references public.forums (id) on delete cascade,
  plan_tier   text not null check (plan_tier in ('pro', 'business')),
  months      integer not null check (months between 1 and 36),
  amount      numeric(12, 2) not null check (amount >= 0),
  reference   text,
  note        text,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists site_plan_payments_site_idx on public.site_plan_payments (site_id, created_at desc);
alter table public.site_plan_payments enable row level security;

drop policy if exists "site_plan_payments_admin_read" on public.site_plan_payments;
create policy "site_plan_payments_admin_read" on public.site_plan_payments
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 4. Platform ads: shown by the founder on every site, or on one chosen site -----------------
create table if not exists public.platform_site_ads (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  body           text not null default '',
  link_url       text not null default '',
  image_url      text not null default '',
  placement      text not null default 'banner' check (placement in ('banner', 'footer')),
  target_site_id uuid references public.forums (id) on delete cascade,   -- null = every site
  is_active      boolean not null default true,
  starts_at      timestamptz,
  ends_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists platform_site_ads_active_idx on public.platform_site_ads (is_active, placement);
alter table public.platform_site_ads enable row level security;

drop policy if exists "platform_site_ads_admin_all" on public.platform_site_ads;
create policy "platform_site_ads_admin_all" on public.platform_site_ads
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
