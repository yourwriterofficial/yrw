-- Growth & scale features (Packages 4.1 - 4.11) for developa.me sites.
-- Safe to re-run (idempotent). RLS enabled on every new table.

-- 4.1 / 4.5 Customer marketing consent & subscribers
alter table public.site_orders
  add column if not exists marketing_consent boolean not null default false;

create table if not exists public.site_subscribers (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references public.forums (id) on delete cascade,
  email             text not null,
  name              text not null default '',
  phone             text not null default '',
  source            text not null default 'order' check (source in ('order', 'member', 'manual')),
  marketing_consent boolean not null default false,
  unsubscribe_token text not null default encode(gen_random_bytes(16), 'hex'),
  unsubscribed_at   timestamptz,
  created_at        timestamptz not null default now(),
  unique (site_id, email)
);
create index if not exists site_subscribers_site_idx on public.site_subscribers (site_id, marketing_consent);
alter table public.site_subscribers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_subscribers' and policyname = 'site_subscribers_owner_all'
  ) then
    create policy "site_subscribers_owner_all" on public.site_subscribers
      for all using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()))
      with check (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));
  end if;
end $$;

-- 4.3 Staff accounts with roles
create table if not exists public.site_staff (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.forums (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('manager', 'packer', 'support')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (site_id, email)
);
create index if not exists site_staff_user_idx on public.site_staff (user_id);
create index if not exists site_staff_site_idx on public.site_staff (site_id);
alter table public.site_staff enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_staff' and policyname = 'site_staff_owner_all'
  ) then
    create policy "site_staff_owner_all" on public.site_staff
      for all using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()))
      with check (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_staff' and policyname = 'site_staff_self_read'
  ) then
    create policy "site_staff_self_read" on public.site_staff
      for select using (user_id = auth.uid());
  end if;
end $$;

-- 4.4 Privacy-friendly visits & traffic analytics
create table if not exists public.site_visits (
  id           bigint generated always as identity primary key,
  site_id      uuid not null references public.forums (id) on delete cascade,
  path         text not null default '/',
  referrer     text not null default '',
  utm_source   text not null default '',
  product_id   uuid,
  session_hash text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists site_visits_site_created_idx on public.site_visits (site_id, created_at desc);
alter table public.site_visits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_visits' and policyname = 'site_visits_owner_read'
  ) then
    create policy "site_visits_owner_read" on public.site_visits
      for select using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));
  end if;
end $$;

-- 4.5 Email newsletter log
create table if not exists public.site_newsletters (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.forums (id) on delete cascade,
  subject     text not null,
  body        text not null,
  sent_count  integer not null default 0,
  month_key   text not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists site_newsletters_site_month_idx on public.site_newsletters (site_id, month_key);
alter table public.site_newsletters enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_newsletters' and policyname = 'site_newsletters_owner_all'
  ) then
    create policy "site_newsletters_owner_all" on public.site_newsletters
      for all using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()))
      with check (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));
  end if;
end $$;

-- 4.7 Scheduled backups + 4.11 Plan expiry reminder state
alter table public.forums
  add column if not exists weekly_backup_email boolean not null default false,
  add column if not exists last_backup_sent_date date,
  add column if not exists plan_reminded_stage text;

-- 4.8 Paid memberships & premium community
create table if not exists public.site_membership_tiers (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references public.forums (id) on delete cascade,
  name          text not null,
  description   text not null default '',
  price         numeric(12, 2) not null check (price >= 0),
  duration_days integer not null default 30 check (duration_days between 1 and 3650),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists site_membership_tiers_site_idx on public.site_membership_tiers (site_id);
alter table public.site_membership_tiers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_membership_tiers' and policyname = 'site_membership_tiers_public_read'
  ) then
    create policy "site_membership_tiers_public_read" on public.site_membership_tiers
      for select using (is_active = true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_membership_tiers' and policyname = 'site_membership_tiers_owner_all'
  ) then
    create policy "site_membership_tiers_owner_all" on public.site_membership_tiers
      for all using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()))
      with check (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));
  end if;
end $$;

create table if not exists public.site_memberships (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references public.forums (id) on delete cascade,
  tier_id           uuid not null references public.site_membership_tiers (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  email             text not null default '',
  status            text not null default 'pending' check (status in ('pending', 'active', 'expired', 'rejected')),
  payment_reference text not null default '',
  expires_at        timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists site_memberships_site_user_idx on public.site_memberships (site_id, user_id, status);
alter table public.site_memberships enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_memberships' and policyname = 'site_memberships_self_or_owner'
  ) then
    create policy "site_memberships_self_or_owner" on public.site_memberships
      for select using (
        user_id = auth.uid()
        or exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid())
      );
  end if;
end $$;

alter table public.forum_threads
  add column if not exists is_members_only boolean not null default false;

-- 4.9 Booking & appointments
create table if not exists public.site_booking_services (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references public.forums (id) on delete cascade,
  title         text not null,
  description   text not null default '',
  duration_mins integer not null default 30 check (duration_mins between 5 and 480),
  price         numeric(12, 2) not null default 0 check (price >= 0),
  slot_days     text[] not null default array['Mon','Tue','Wed','Thu','Fri'],
  slot_hours    text[] not null default array['09:00','11:00','14:00','16:00'],
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists site_booking_services_site_idx on public.site_booking_services (site_id);
alter table public.site_booking_services enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_booking_services' and policyname = 'site_booking_services_public_read'
  ) then
    create policy "site_booking_services_public_read" on public.site_booking_services
      for select using (is_active = true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_booking_services' and policyname = 'site_booking_services_owner_all'
  ) then
    create policy "site_booking_services_owner_all" on public.site_booking_services
      for all using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()))
      with check (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));
  end if;
end $$;

create table if not exists public.site_bookings (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.forums (id) on delete cascade,
  service_id  uuid not null references public.site_booking_services (id) on delete cascade,
  buyer_name  text not null,
  buyer_email text not null,
  buyer_phone text not null default '',
  slot_date   date not null,
  slot_time   text not null,
  notes       text not null default '',
  status      text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  reminded_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (service_id, slot_date, slot_time)
);
create index if not exists site_bookings_site_date_idx on public.site_bookings (site_id, slot_date);
alter table public.site_bookings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_bookings' and policyname = 'site_bookings_owner_all'
  ) then
    create policy "site_bookings_owner_all" on public.site_bookings
      for all using (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()))
      with check (exists (select 1 from public.forums f where f.id = site_id and f.owner_id = auth.uid()));
  end if;
end $$;

-- 4.10 Priority support requests
create table if not exists public.site_support_requests (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.forums (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  subject         text not null,
  message         text not null,
  whatsapp_number text not null default '',
  status          text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  admin_reply     text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists site_support_requests_site_idx on public.site_support_requests (site_id, created_at desc);
alter table public.site_support_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_support_requests' and policyname = 'site_support_owner_read'
  ) then
    create policy "site_support_owner_read" on public.site_support_requests
      for select using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_support_requests' and policyname = 'site_support_admin_all'
  ) then
    create policy "site_support_admin_all" on public.site_support_requests
      for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
  end if;
end $$;
