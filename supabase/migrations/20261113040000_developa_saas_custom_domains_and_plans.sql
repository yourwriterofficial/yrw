-- Extend developa.me sites with custom domains, plans, and branding
-- Safe to re-run

alter table public.forums
  add column if not exists custom_domain text unique,
  add column if not exists custom_domain_verified boolean not null default false,
  add column if not exists plan_tier text not null default 'free'
    check (plan_tier in ('free', 'pro', 'business')),
  add column if not exists logo_url text not null default '',
  add column if not exists hide_branding boolean not null default false;

create index if not exists idx_forums_custom_domain on public.forums(custom_domain);

-- RPC for high-performance domain resolution in middleware/proxy
create or replace function public.resolve_site_by_domain(p_host text)
returns table (
  id uuid,
  slug text,
  custom_domain text,
  site_mode text,
  is_public boolean
)
language sql
security definer
set search_path = public
as $$
  select id, slug, custom_domain, site_mode, is_public
  from public.forums
  where custom_domain = lower(trim(p_host))
     or slug = lower(trim(p_host))
  limit 1;
$$;
