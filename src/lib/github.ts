import { Octokit } from "@octokit/rest";

const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Pipfile.lock",
  "poetry.lock",
  "Gemfile.lock",
  "Cargo.lock",
  "go.sum",
]);

export interface GhRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  pushed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  owner: { login: string };
}

export function getServerToken(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN is not set");
  return t;
}

export function octokit(token: string) {
  return new Octokit({ auth: token });
}

export async function listOwnerRepos(token: string): Promise<GhRepo[]> {
  const ok = octokit(token);
  const repos = await ok.paginate(ok.repos.listForAuthenticatedUser, {
    affiliation: "owner",
    per_page: 100,
  });
  return repos as unknown as GhRepo[];
}

export async function fetchReadmeExcerpt(
  token: string,
  owner: string,
  repo: string,
): Promise<string | null> {
  const ok = octokit(token);
  try {
    const res = await ok.repos.getReadme({ owner, repo, mediaType: { format: "raw" } });
    const body = res.data as unknown as string;
    if (typeof body !== "string") return null;
    return body.slice(0, 8 * 1024);
  } catch (e: unknown) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

export interface RootInspection {
  hasLockfile: boolean;
  entries: string[];
}

export async function inspectRoot(
  token: string,
  owner: string,
  repo: string,
): Promise<RootInspection> {
  const ok = octokit(token);
  try {
    const res = await ok.repos.getContent({ owner, repo, path: "" });
    if (!Array.isArray(res.data)) return { hasLockfile: false, entries: [] };
    const entries = res.data.map((e) => (e.type === "dir" ? `${e.name}/` : e.name));
    const hasLockfile = res.data.some((e) => e.type === "file" && LOCKFILES.has(e.name));
    return { hasLockfile, entries };
  } catch {
    return { hasLockfile: false, entries: [] };
  }
}

export async function countRecentCommits(
  token: string,
  owner: string,
  repo: string,
  since: string,
): Promise<number> {
  const ok = octokit(token);
  try {
    const res = await ok.request("GET /repos/{owner}/{repo}/commits", {
      owner,
      repo,
      since,
      per_page: 1,
    });
    const link = res.headers.link as string | undefined;
    if (link) {
      const m = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
      if (m) return parseInt(m[1], 10);
    }
    return Array.isArray(res.data) ? res.data.length : 0;
  } catch {
    return 0;
  }
}

export async function fetchLanguages(
  token: string,
  owner: string,
  repo: string,
): Promise<Record<string, number> | null> {
  const ok = octokit(token);
  try {
    const res = await ok.repos.listLanguages({ owner, repo });
    return res.data as Record<string, number>;
  } catch {
    return null;
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
