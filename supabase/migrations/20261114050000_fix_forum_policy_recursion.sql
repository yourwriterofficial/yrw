-- Fix: "infinite recursion detected in policy for relation forums".
--
-- The SELECT rule on `forums` looks in `forum_members`, and the SELECT rule on `forum_members` looks back
-- in `forums`, so any query made with a normal (non-service) key loops. Two small SECURITY DEFINER
-- functions read the other table without triggering its row-level security, which breaks the loop.
-- The rules mean exactly what they meant before. Uses ALTER POLICY, so nothing is dropped and it is safe to re-run.

create or replace function public.is_forum_member(p_forum uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.forum_members fm
    where fm.forum_id = p_forum and fm.user_id = auth.uid()
  );
$$;

create or replace function public.forum_is_public_or_mine(p_forum uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.forums f
    where f.id = p_forum and (f.is_public = true or f.owner_id = auth.uid())
  );
$$;

grant execute on function public.is_forum_member(uuid) to anon, authenticated;
grant execute on function public.forum_is_public_or_mine(uuid) to anon, authenticated;

-- A forum is visible if it is public, you own it, or you are a member.
alter policy "forums_select_public_or_member" on public.forums
  using (is_public = true or owner_id = auth.uid() or public.is_forum_member(id));

-- You can see a membership row if it is yours, or the forum is public or yours.
alter policy "forum_members_select_visible" on public.forum_members
  using (user_id = auth.uid() or public.forum_is_public_or_mine(forum_id));
