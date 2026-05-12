-- Run this in the Supabase SQL editor after creating your project.

create table repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
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
  top_entries jsonb not null default '[]',
  languages jsonb,
  synced_at timestamptz not null default now(),
  unique(user_id, github_id)
);

alter table repos enable row level security;
create policy "users manage own repos"
  on repos for all using (auth.uid() = user_id);

create table repo_meta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  github_id bigint not null,
  manual_status text,
  category text,
  notes text,
  tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, github_id)
);

alter table repo_meta enable row level security;
create policy "users manage own meta"
  on repo_meta for all using (auth.uid() = user_id);

create table ai_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  github_id bigint not null,
  summary text not null,
  generated_at timestamptz not null default now(),
  readme_hash text not null,
  unique(user_id, github_id)
);

alter table ai_summaries enable row level security;
create policy "users manage own ai summaries"
  on ai_summaries for all using (auth.uid() = user_id);
