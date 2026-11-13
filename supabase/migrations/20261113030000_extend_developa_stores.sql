-- Extend [name].developa.me sites with E-commerce Storefront, Templates, and Manual Bank Transfer Payments.
-- Safe to re-run.

alter table public.forums
  add column if not exists site_mode text not null default 'forum'
    check (site_mode in ('forum', 'store', 'both')),
  add column if not exists template_id text not null default 'community-forum',
  add column if not exists hero_headline text not null default '',
  add column if not exists hero_subheadline text not null default '',
  add column if not exists currency text not null default 'NGN',
  add column if not exists whatsapp_number text not null default '',
  add column if not exists bank_name text not null default '',
  add column if not exists bank_account_number text not null default '',
  add column if not exists bank_account_name text not null default '',
  add column if not exists payment_instructions text not null default '';

create table if not exists public.site_products (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.forums(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'General',
  product_type text not null default 'physical'
    check (product_type in ('physical', 'digital', 'service')),
  price numeric(12,2) not null default 0 check (price >= 0),
  compare_at_price numeric(12,2),
  image_url text not null default '',
  digital_url text not null default '',
  stock_qty int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_products_site_active
  on public.site_products(site_id, is_active, sort_order, created_at desc);

create table if not exists public.site_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  site_id uuid not null references public.forums(id) on delete cascade,
  buyer_id uuid references auth.users(id) on delete set null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text not null default '',
  delivery_address text not null default '',
  notes text not null default '',
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_method text not null default 'manual_transfer'
    check (payment_method in ('manual_transfer', 'pay_on_delivery')),
  payment_reference text not null default '',
  payment_proof_note text not null default '',
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'proof_submitted', 'paid', 'rejected')),
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'processing', 'shipped', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_orders_site_created
  on public.site_orders(site_id, created_at desc);
create index if not exists idx_site_orders_buyer
  on public.site_orders(buyer_id, created_at desc);

alter table public.site_products enable row level security;
alter table public.site_orders enable row level security;

drop policy if exists "site_products_select_public_or_owner" on public.site_products;
create policy "site_products_select_public_or_owner"
  on public.site_products for select
  using (
    is_active = true
    or exists (
      select 1 from public.forums f
      where f.id = site_products.site_id and f.owner_id = auth.uid()
    )
  );

drop policy if exists "site_products_manage_owner" on public.site_products;
create policy "site_products_manage_owner"
  on public.site_products for all
  to authenticated
  using (
    exists (
      select 1 from public.forums f
      where f.id = site_products.site_id and f.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.forums f
      where f.id = site_products.site_id and f.owner_id = auth.uid()
    )
  );

drop policy if exists "site_orders_select_owner_or_buyer" on public.site_orders;
create policy "site_orders_select_owner_or_buyer"
  on public.site_orders for select
  to authenticated
  using (
    buyer_id = auth.uid()
    or exists (
      select 1 from public.forums f
      where f.id = site_orders.site_id and f.owner_id = auth.uid()
    )
  );

drop policy if exists "site_orders_update_owner" on public.site_orders;
create policy "site_orders_update_owner"
  on public.site_orders for update
  to authenticated
  using (
    exists (
      select 1 from public.forums f
      where f.id = site_orders.site_id and f.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.forums f
      where f.id = site_orders.site_id and f.owner_id = auth.uid()
    )
  );
