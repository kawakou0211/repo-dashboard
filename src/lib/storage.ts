"use client";
import type { AiSummary, Repository, RepoMeta, RepoWithMeta, SummaryContext } from "@/types/db";

const KEY_REPOS = "rd:repos";
const KEY_META = "rd:meta";
const KEY_AI = "rd:ai";
const KEY_SYNCED = "rd:synced_at";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadRepos(): Repository[] {
  return read<Repository[]>(KEY_REPOS, []);
}

export function saveRepos(repos: Repository[]): void {
  write(KEY_REPOS, repos);
  write(KEY_SYNCED, new Date().toISOString());
}

export function getSyncedAt(): string | null {
  return read<string | null>(KEY_SYNCED, null);
}

export function loadAllMeta(): Record<number, RepoMeta> {
  return read<Record<number, RepoMeta>>(KEY_META, {});
}

export function getMeta(githubId: number): RepoMeta | null {
  return loadAllMeta()[githubId] ?? null;
}

export function setMeta(githubId: number, patch: Partial<RepoMeta>): RepoMeta {
  const all = loadAllMeta();
  const current: RepoMeta = all[githubId] ?? {
    manual_status: null,
    category: null,
    notes: null,
    tags: [],
    updated_at: new Date().toISOString(),
  };
  const next: RepoMeta = { ...current, ...patch, updated_at: new Date().toISOString() };
  all[githubId] = next;
  write(KEY_META, all);
  return next;
}

export function loadAllAi(): Record<number, AiSummary> {
  return read<Record<number, AiSummary>>(KEY_AI, {});
}

export function getAi(githubId: number): AiSummary | null {
  return loadAllAi()[githubId] ?? null;
}

export function setAi(githubId: number, ai: AiSummary): void {
  const all = loadAllAi();
  all[githubId] = ai;
  write(KEY_AI, all);
}

export function withMeta(repos: Repository[]): RepoWithMeta[] {
  const meta = loadAllMeta();
  const ai = loadAllAi();
  return repos.map((r) => ({ ...r, meta: meta[r.github_id] ?? null, ai: ai[r.github_id] ?? null }));
}

// Cheap non-cryptographic hash for change detection.
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
