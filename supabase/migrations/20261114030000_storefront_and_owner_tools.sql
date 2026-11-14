-- Storefront & owner tools (Packages 2.2 - 2.14) for developa.me sites.
-- Safe to re-run (idempotent). RLS enabled on every new table.

-- 2.2 Multiple photos per product
alter table public.site_products
  add column if not exists image_urls text[] not null default '{}';

-- 2.3 Product variants
alter table public.site_products
  add column if not exists variant_options text[] not null default '{}';

create table if not exists public.site_product_variants (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.forums (id) on delete cascade,
  product_id  uuid not null references public.site_products (id) on delete cascade,
  label       text not null,
  options     jsonb not null default '{}'::jsonb,
  price       numeric(12, 2) not null check (price >= 0),
  stock_qty   integer check (stock_qty is null or stock_qty >= 0),
  sku         text not null default '',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists site_product_variants_prod_idx on public.site_product_variants (product_id, sort_order);
create index if not exists site_product_variants_site_idx on public.site_product_variants (site_id);
alter table public.site_product_variants enable row level security;

drop policy if exists "site_variants_public_read" on public.site_product_variants;
create policy "site_variants_public_read" on public.site_product_variants
  for select using (
    is_active = true
    and exists (select 1 from public.forums f where f.id = site_id and f.is_public = true)
  );

drop policy if exists "site_variants_owner_all" on public.site_product_variants;
create policy "site_variants_owner_all" on public.site_product_variants
  for all using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));

-- 2.5 Reviews & ratings
create table if not exists public.site_reviews (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.forums (id) on delete cascade,
  product_id  uuid not null references public.site_products (id) on delete cascade,
  order_id    uuid not null references public.site_orders (id) on delete cascade,
  buyer_name  text not null,
  rating      integer not null check (rating between 1 and 5),
  body        text not null default '',
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (order_id, product_id)
);
create index if not exists site_reviews_prod_idx on public.site_reviews (product_id, is_visible, created_at desc);
create index if not exists site_reviews_site_idx on public.site_reviews (site_id, created_at desc);
alter table public.site_reviews enable row level security;

drop policy if exists "site_reviews_public_read" on public.site_reviews;
create policy "site_reviews_public_read" on public.site_reviews
  for select using (
    is_visible = true
    and exists (select 1 from public.forums f where f.id = site_id and f.is_public = true)
  );

drop policy if exists "site_reviews_owner_all" on public.site_reviews;
create policy "site_reviews_owner_all" on public.site_reviews
  for all using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));

alter table public.site_orders
  add column if not exists review_reminded_at timestamptz;

-- 2.6 Info pages + 2.7 Social links + 2.9 Pickup + 2.11 Daily summary + 2.14 Verified badge
alter table public.forums
  add column if not exists page_about text not null default '',
  add column if not exists page_delivery text not null default '',
  add column if not exists page_returns text not null default '',
  add column if not exists page_contact_note text not null default '',
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists pickup_address text not null default '',
  add column if not exists summary_email boolean not null default true,
  add column if not exists last_summary_sent_date date,
  add column if not exists verified boolean not null default false,
  add column if not exists verified_at timestamptz;

-- 2.9 Shipping zones & order delivery metadata
create table if not exists public.site_shipping_zones (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.forums (id) on delete cascade,
  name        text not null,
  states      text[] not null default '{}',
  fee         numeric(12, 2) not null default 0 check (fee >= 0),
  free_over   numeric(12, 2) check (free_over is null or free_over >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists site_shipping_zones_site_idx on public.site_shipping_zones (site_id);
alter table public.site_shipping_zones enable row level security;

drop policy if exists "site_shipping_public_read" on public.site_shipping_zones;
create policy "site_shipping_public_read" on public.site_shipping_zones
  for select using (
    is_active = true
    and exists (select 1 from public.forums f where f.id = site_id and f.is_public = true)
  );

drop policy if exists "site_shipping_owner_all" on public.site_shipping_zones;
create policy "site_shipping_owner_all" on public.site_shipping_zones
  for all using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));

alter table public.site_orders
  add column if not exists shipping_fee numeric(12, 2) not null default 0,
  add column if not exists shipping_zone text not null default '',
  add column if not exists delivery_method text not null default 'delivery',
  add column if not exists delivery_state text not null default '';

-- 2.11 Low-stock threshold per product
alter table public.site_products
  add column if not exists low_stock_at integer not null default 3,
  add column if not exists low_stock_alerted_at timestamptz;

-- 2.12 Abandoned carts
create table if not exists public.site_carts (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references public.forums (id) on delete cascade,
  email             text not null default '',
  phone             text not null default '',
  buyer_name        text not null default '',
  items             jsonb not null default '[]'::jsonb,
  total             numeric(12, 2) not null default 0,
  status            text not null default 'open' check (status in ('open', 'converted', 'unsubscribed')),
  reminder_count    integer not null default 0,
  reminded_at       timestamptz,
  unsubscribe_token text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists site_carts_site_status_idx on public.site_carts (site_id, status, updated_at desc);
alter table public.site_carts enable row level security;

drop policy if exists "site_carts_owner_read" on public.site_carts;
create policy "site_carts_owner_read" on public.site_carts
  for select using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));

-- 2.13 Private order notes & refund/return events
alter table public.site_orders
  add column if not exists internal_note text not null default '',
  add column if not exists refunded_amount numeric(12, 2) not null default 0;

create table if not exists public.site_order_events (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references public.forums (id) on delete cascade,
  order_id       uuid not null references public.site_orders (id) on delete cascade,
  kind           text not null check (kind in ('refund', 'return', 'note')),
  note           text not null default '',
  amount         numeric(12, 2) not null default 0,
  stock_returned boolean not null default false,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists site_order_events_order_idx on public.site_order_events (order_id, created_at desc);
alter table public.site_order_events enable row level security;

drop policy if exists "site_order_events_owner_all" on public.site_order_events;
create policy "site_order_events_owner_all" on public.site_order_events
  for all using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));
