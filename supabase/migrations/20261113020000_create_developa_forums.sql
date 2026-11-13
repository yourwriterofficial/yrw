-- Multi-tenant user-created forums hosted under [name].developa.me
-- Safe to re-run (uses IF NOT EXISTS / DROP TRIGGER IF EXISTS / DROP POLICY IF EXISTS).

create table if not exists public.forums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  owner_id uuid not null references auth.users(id) on delete cascade,
  is_public boolean not null default true,
  accent_color text not null default '#06b6d4',
  member_count int not null default 1,
  thread_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forums_slug_format check (
    slug ~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$'
  ),
  constraint forums_slug_not_reserved check (
    slug not in (
      'www', 'api', 'app', 'admin', 'auth', 'shop', 'forum', 'forums',
      'mail', 'cdn', 'static', 'assets', 'staging', 'dev', 'developa',
      'support', 'billing', 'docs', 'status', 'blog', 'help', 'dashboard',
      'login', 'register', 'order', 'scripts', 'developer', 'projects'
    )
  )
);

create index if not exists idx_forums_owner_id on public.forums(owner_id);
create index if not exists idx_forums_public_activity on public.forums(is_public, thread_count desc, created_at desc);

create table if not exists public.forum_members (
  forum_id uuid not null references public.forums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  created_at timestamptz not null default now(),
  primary key (forum_id, user_id)
);

create index if not exists idx_forum_members_user_id on public.forum_members(user_id);

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  forum_id uuid not null references public.forums(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  reply_count int not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_forum_threads_listing
  on public.forum_threads(forum_id, is_pinned desc, last_activity_at desc);
create index if not exists idx_forum_threads_author on public.forum_threads(author_id);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  forum_id uuid not null references public.forums(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_forum_posts_thread on public.forum_posts(thread_id, created_at asc);
create index if not exists idx_forum_posts_forum on public.forum_posts(forum_id);

-- Atomic counter triggers
create or replace function public.sync_forum_thread_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.forums
      set thread_count = thread_count + 1,
          updated_at = now()
      where id = new.forum_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.forums
      set thread_count = greatest(0, thread_count - 1),
          updated_at = now()
      where id = old.forum_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_forum_threads_count on public.forum_threads;
create trigger trg_forum_threads_count
after insert or delete on public.forum_threads
for each row execute function public.sync_forum_thread_count();

create or replace function public.sync_forum_post_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.forum_threads
      set reply_count = reply_count + 1,
          last_activity_at = new.created_at,
          updated_at = now()
      where id = new.thread_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.forum_threads
      set reply_count = greatest(0, reply_count - 1),
          updated_at = now()
      where id = old.thread_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_forum_posts_count on public.forum_posts;
create trigger trg_forum_posts_count
after insert or delete on public.forum_posts
for each row execute function public.sync_forum_post_count();

create or replace function public.sync_forum_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.forums
      set member_count = (
        select count(*)::int from public.forum_members where forum_id = new.forum_id
      )
      where id = new.forum_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.forums
      set member_count = (
        select count(*)::int from public.forum_members where forum_id = old.forum_id
      )
      where id = old.forum_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_forum_members_count on public.forum_members;
create trigger trg_forum_members_count
after insert or delete on public.forum_members
for each row execute function public.sync_forum_member_count();

-- RLS
alter table public.forums enable row level security;
alter table public.forum_members enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;

drop policy if exists "forums_select_public_or_member" on public.forums;
create policy "forums_select_public_or_member"
  on public.forums for select
  using (
    is_public = true
    or owner_id = auth.uid()
    or exists (
      select 1 from public.forum_members fm
      where fm.forum_id = forums.id and fm.user_id = auth.uid()
    )
  );

drop policy if exists "forums_insert_authenticated" on public.forums;
create policy "forums_insert_authenticated"
  on public.forums for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "forums_update_owner" on public.forums;
create policy "forums_update_owner"
  on public.forums for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "forums_delete_owner" on public.forums;
create policy "forums_delete_owner"
  on public.forums for delete
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "forum_members_select_visible" on public.forum_members;
create policy "forum_members_select_visible"
  on public.forum_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.forums f
      where f.id = forum_members.forum_id and (f.is_public = true or f.owner_id = auth.uid())
    )
  );

drop policy if exists "forum_members_insert_self" on public.forum_members;
create policy "forum_members_insert_self"
  on public.forum_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      role = 'member'
      or exists (
        select 1 from public.forums f
        where f.id = forum_members.forum_id and f.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "forum_members_delete_self_or_owner" on public.forum_members;
create policy "forum_members_delete_self_or_owner"
  on public.forum_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.forums f
      where f.id = forum_members.forum_id and f.owner_id = auth.uid()
    )
  );

drop policy if exists "forum_threads_select_visible" on public.forum_threads;
create policy "forum_threads_select_visible"
  on public.forum_threads for select
  using (
    exists (
      select 1 from public.forums f
      where f.id = forum_threads.forum_id
        and (
          f.is_public = true
          or f.owner_id = auth.uid()
          or exists (
            select 1 from public.forum_members fm
            where fm.forum_id = f.id and fm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "forum_threads_insert_allowed" on public.forum_threads;
create policy "forum_threads_insert_allowed"
  on public.forum_threads for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.forums f
      where f.id = forum_threads.forum_id
        and (
          f.is_public = true
          or f.owner_id = auth.uid()
          or exists (
            select 1 from public.forum_members fm
            where fm.forum_id = f.id and fm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "forum_threads_delete_author_or_owner" on public.forum_threads;
create policy "forum_threads_delete_author_or_owner"
  on public.forum_threads for delete
  to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.forums f
      where f.id = forum_threads.forum_id and f.owner_id = auth.uid()
    )
  );

drop policy if exists "forum_posts_select_visible" on public.forum_posts;
create policy "forum_posts_select_visible"
  on public.forum_posts for select
  using (
    exists (
      select 1 from public.forums f
      where f.id = forum_posts.forum_id
        and (
          f.is_public = true
          or f.owner_id = auth.uid()
          or exists (
            select 1 from public.forum_members fm
            where fm.forum_id = f.id and fm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "forum_posts_insert_allowed" on public.forum_posts;
create policy "forum_posts_insert_allowed"
  on public.forum_posts for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.forum_threads t
      join public.forums f on f.id = t.forum_id
      where t.id = forum_posts.thread_id
        and t.forum_id = forum_posts.forum_id
        and t.is_locked = false
        and (
          f.is_public = true
          or f.owner_id = auth.uid()
          or exists (
            select 1 from public.forum_members fm
            where fm.forum_id = f.id and fm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "forum_posts_delete_author_or_owner" on public.forum_posts;
create policy "forum_posts_delete_author_or_owner"
  on public.forum_posts for delete
  to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.forums f
      where f.id = forum_posts.forum_id and f.owner_id = auth.uid()
    )
  );
