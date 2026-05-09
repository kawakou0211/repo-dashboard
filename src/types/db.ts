export type ManualStatus = "developing" | "done" | "paused" | "archived" | "idea";

export type ActivityStatus = "active" | "dormant" | "stale";

export type EffectiveStatus = ManualStatus | ActivityStatus;

// Data fetched from GitHub
export interface Repository {
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
}

// Stored in localStorage
export interface RepoMeta {
  manual_status: ManualStatus | null;
  category: string | null;
  notes: string | null;
  tags: string[];
  updated_at: string;
}

export interface AiSummary {
  summary: string;
  generated_at: string;
  readme_hash: string;
}

export interface RepoWithMeta extends Repository {
  meta: RepoMeta | null;
  ai: AiSummary | null;
}
