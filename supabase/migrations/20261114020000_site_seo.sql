-- Per-store search appearance: the title and description Google shows for a store.
-- Safe to re-run.

alter table public.forums
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '';
