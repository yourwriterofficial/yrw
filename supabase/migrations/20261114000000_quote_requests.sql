-- Stores every quote request from the home page and /developer, so a request is
-- never lost if an email fails to send, and the admin can see what is still open.
-- Written by the server (service role) only; admins may read it.

create table if not exists quote_requests (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  whatsapp    text,
  service     text not null check (service in ('academic', 'statistics', 'content', 'resume', 'dev')),
  deadline    text,
  details     text not null,
  brand       text not null default 'yourresearchwriter',
  status      text not null default 'NEW' check (status in ('NEW', 'REPLIED', 'WON', 'LOST', 'SPAM')),
  notified    boolean not null default false,
  notes       text
);

create index if not exists quote_requests_status_idx on quote_requests (status, created_at desc);
create index if not exists quote_requests_email_idx  on quote_requests (lower(email));

alter table quote_requests enable row level security;

drop policy if exists "quote_requests_admin_read" on quote_requests;
create policy "quote_requests_admin_read" on quote_requests
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "quote_requests_admin_update" on quote_requests;
create policy "quote_requests_admin_update" on quote_requests
  for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
