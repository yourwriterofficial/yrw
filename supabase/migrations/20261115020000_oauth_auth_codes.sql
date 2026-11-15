create table if not exists public.oauth_auth_codes (
  code_hash text primary key,
  client_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists oauth_auth_codes_expires_at_idx on public.oauth_auth_codes (expires_at);
alter table public.oauth_auth_codes enable row level security; -- no policies: service role only
