-- Premium themes (founder sets prices), per-site plugins, and per-site push notifications.
-- Safe to re-run.

-- 1. Theme catalog: the founder's price and visibility overrides for each theme --------------
-- Themes themselves live in code (lib/siteTemplates.ts). A row here overrides the default price.
create table if not exists public.theme_catalog (
  template_id text primary key,
  price_ngn   integer not null default 0 check (price_ngn >= 0),
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table public.theme_catalog enable row level security;   -- served only through the server

-- 2. Theme purchases: a user asks to buy a theme, the founder confirms the transfer -------------
create table if not exists public.theme_purchases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  template_id text not null,
  amount      integer not null check (amount >= 0),
  status      text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  reference   text not null,
  note        text,
  created_at  timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists theme_purchases_user_idx on public.theme_purchases (user_id, template_id);
create index if not exists theme_purchases_status_idx on public.theme_purchases (status, created_at desc);
alter table public.theme_purchases enable row level security;

-- A person can see their own purchases. Everything else goes through the server.
drop policy if exists "theme_purchases_own_read" on public.theme_purchases;
create policy "theme_purchases_own_read" on public.theme_purchases
  for select using (user_id = auth.uid());

-- 3. Plugins: which add-ons a site owner has switched on ---------------------------------------
alter table public.forums
  add column if not exists plugins jsonb not null default '{}'::jsonb;

-- 4. Push notifications for a site (owner alerts and buyer order updates) -----------------------
create table if not exists public.site_push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.forums (id) on delete cascade,
  audience    text not null check (audience in ('owner', 'buyer')),
  user_id     uuid references auth.users (id) on delete cascade,
  buyer_email text,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  unique (site_id, endpoint)
);
create index if not exists site_push_site_idx on public.site_push_subscriptions (site_id, audience);
alter table public.site_push_subscriptions enable row level security;   -- served only through the server

-- 5. Clean-up of abandoned free sites: when the owner was warned -------------------------------
alter table public.forums
  add column if not exists prune_warned_at timestamptz,
  add column if not exists prune_final_warned_at timestamptz;
