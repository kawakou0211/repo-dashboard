-- repo-dashboard initial schema
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

-- ============================================================
-- repositories
-- ============================================================
create table if not exists repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  github_id bigint not null,
  name text not null,
  full_name text not null,
  description text,
  html_url text not null,
  is_private boolean not null default false,
  is_fork boolean not null default false,
  is_archived boolean not null default false,
  primary_language text,
  pushed_at timestamptz,
  created_at_gh timestamptz,
  updated_at_gh timestamptz,
  has_readme boolean not null default false,
  has_lockfile boolean not null default false,
  readme_excerpt text,
  ai_summary text,
  ai_summary_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (user_id, github_id)
);

create index if not exists idx_repositories_user on repositories(user_id);
create index if not exists idx_repositories_pushed on repositories(pushed_at desc);

-- ============================================================
-- repo_meta (manual fields, never overwritten by sync)
-- ============================================================
create table if not exists repo_meta (
  repository_id uuid primary key references repositories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  manual_status text,
  category text,
  notes text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- tags
-- ============================================================
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unique (user_id, name)
);

create table if not exists repo_tags (
  repository_id uuid not null references repositories(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (repository_id, tag_id)
);

-- ============================================================
-- sync_runs
-- ============================================================
create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  repo_count int,
  error text
);

create index if not exists idx_sync_runs_user_started on sync_runs(user_id, started_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table repositories enable row level security;
alter table repo_meta enable row level security;
alter table tags enable row level security;
alter table repo_tags enable row level security;
alter table sync_runs enable row level security;

drop policy if exists "own rows" on repositories;
create policy "own rows" on repositories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on repo_meta;
create policy "own rows" on repo_meta
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on tags;
create policy "own rows" on tags
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on repo_tags;
create policy "own rows" on repo_tags
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on sync_runs;
create policy "own rows" on sync_runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
