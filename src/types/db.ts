export type ManualStatus = "developing" | "done" | "paused" | "archived" | "idea";

export type ActivityStatus = "active" | "dormant" | "stale";

export type EffectiveStatus = ManualStatus | ActivityStatus;

export interface Repository {
  id: string;
  user_id: string;
  github_id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  is_private: boolean;
  is_fork: boolean;
  is_archived: boolean;
  primary_language: string | null;
  pushed_at: string | null;
  created_at_gh: string | null;
  updated_at_gh: string | null;
  has_readme: boolean;
  has_lockfile: boolean;
  readme_excerpt: string | null;
  ai_summary: string | null;
  ai_summary_at: string | null;
  synced_at: string;
}

export interface RepoMeta {
  repository_id: string;
  user_id: string;
  manual_status: ManualStatus | null;
  category: string | null;
  notes: string | null;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
}

export interface RepoWithMeta extends Repository {
  repo_meta: RepoMeta | null;
  tags: Tag[];
}
