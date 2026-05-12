"use client";
import { createClient } from "@/lib/supabase/client";
import type { AiSummary, Repository, RepoMeta, RepoWithMeta, SummaryContext } from "@/types/db";

export async function loadRepos(): Promise<Repository[]> {
  const supabase = createClient();
  const { data } = await supabase.from("repos").select("*").order("pushed_at", { ascending: false });
  if (!data) return [];
  return data.map(rowToRepo);
}

export async function saveRepos(repos: Repository[]): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const rows = repos.map((repo) => ({
    user_id: user.id,
    github_id: repo.github_id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    html_url: repo.html_url,
    is_private: repo.is_private,
    is_fork: repo.is_fork,
    is_archived: repo.is_archived,
    primary_language: repo.primary_language,
    pushed_at: repo.pushed_at,
    created_at_gh: repo.created_at_gh,
    updated_at_gh: repo.updated_at_gh,
    has_readme: repo.has_readme,
    has_lockfile: repo.has_lockfile,
    readme_excerpt: repo.readme_excerpt,
    top_entries: repo.top_entries,
    languages: repo.languages,
    synced_at: new Date().toISOString(),
  }));

  await supabase.from("repos").upsert(rows, { onConflict: "user_id,github_id" });
}

export async function getSyncedAt(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("repos")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.synced_at ?? null;
}

export async function loadAllMeta(): Promise<Record<number, RepoMeta>> {
  const supabase = createClient();
  const { data } = await supabase.from("repo_meta").select("*");
  if (!data) return {};
  const result: Record<number, RepoMeta> = {};
  for (const row of data) {
    result[row.github_id] = {
      manual_status: row.manual_status,
      category: row.category,
      notes: row.notes,
      tags: row.tags ?? [],
      updated_at: row.updated_at,
    };
  }
  return result;
}

export async function getMeta(githubId: number): Promise<RepoMeta | null> {
  const supabase = createClient();
  const { data } = await supabase.from("repo_meta").select("*").eq("github_id", githubId).maybeSingle();
  if (!data) return null;
  return {
    manual_status: data.manual_status,
    category: data.category,
    notes: data.notes,
    tags: data.tags ?? [],
    updated_at: data.updated_at,
  };
}

export async function setMeta(githubId: number, patch: Partial<RepoMeta>): Promise<RepoMeta> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const existing = await getMeta(githubId);
  const next: RepoMeta = {
    manual_status: null,
    category: null,
    notes: null,
    tags: [],
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  await supabase.from("repo_meta").upsert(
    {
      user_id: user.id,
      github_id: githubId,
      manual_status: next.manual_status,
      category: next.category,
      notes: next.notes,
      tags: next.tags,
      updated_at: next.updated_at,
    },
    { onConflict: "user_id,github_id" },
  );

  return next;
}

export async function loadAllAi(): Promise<Record<number, AiSummary>> {
  const supabase = createClient();
  const { data } = await supabase.from("ai_summaries").select("*");
  if (!data) return {};
  const result: Record<number, AiSummary> = {};
  for (const row of data) {
    result[row.github_id] = {
      summary: row.summary,
      generated_at: row.generated_at,
      readme_hash: row.readme_hash,
    };
  }
  return result;
}

export async function getAi(githubId: number): Promise<AiSummary | null> {
  const supabase = createClient();
  const { data } = await supabase.from("ai_summaries").select("*").eq("github_id", githubId).maybeSingle();
  if (!data) return null;
  return {
    summary: data.summary,
    generated_at: data.generated_at,
    readme_hash: data.readme_hash,
  };
}

export async function setAi(githubId: number, ai: AiSummary): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("ai_summaries").upsert(
    {
      user_id: user.id,
      github_id: githubId,
      summary: ai.summary,
      generated_at: ai.generated_at,
      readme_hash: ai.readme_hash,
    },
    { onConflict: "user_id,github_id" },
  );
}

export async function withMeta(repos: Repository[]): Promise<RepoWithMeta[]> {
  const [meta, ai] = await Promise.all([loadAllMeta(), loadAllAi()]);
  return repos.map((r) => ({ ...r, meta: meta[r.github_id] ?? null, ai: ai[r.github_id] ?? null }));
}

function rowToRepo(row: Record<string, unknown>): Repository {
  return {
    github_id: row.github_id as number,
    name: row.name as string,
    full_name: row.full_name as string,
    description: row.description as string | null,
    html_url: row.html_url as string,
    is_private: row.is_private as boolean,
    is_fork: row.is_fork as boolean,
    is_archived: row.is_archived as boolean,
    primary_language: row.primary_language as string | null,
    pushed_at: row.pushed_at as string | null,
    created_at_gh: row.created_at_gh as string | null,
    updated_at_gh: row.updated_at_gh as string | null,
    has_readme: row.has_readme as boolean,
    has_lockfile: row.has_lockfile as boolean,
    readme_excerpt: row.readme_excerpt as string | null,
    top_entries: (row.top_entries as string[]) ?? [],
    languages: row.languages as Record<string, number> | null,
  };
}

export function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h);
}

export function summaryContext(repo: Repository): SummaryContext {
  return {
    name: repo.name,
    description: repo.description,
    primary_language: repo.primary_language,
    languages: repo.languages,
    top_entries: repo.top_entries,
    readme_excerpt: repo.readme_excerpt,
  };
}

export function contextHash(ctx: SummaryContext): string {
  return hash(JSON.stringify(ctx));
}
