import { requireUser } from "@/lib/auth";
import RepoCard from "@/components/RepoCard";
import FilterBar from "@/components/FilterBar";
import SyncButton from "@/components/SyncButton";
import SignOutButton from "@/components/SignOutButton";
import { effectiveStatus } from "@/lib/status";
import { restartScore } from "@/lib/score";
import type { RepoWithMeta } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; tag?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const sp = await searchParams;

  const { data: reposRaw } = await supabase
    .from("repositories")
    .select("*, repo_meta(*), repo_tags(tag:tags(*))")
    .eq("user_id", user.id);

  const repos: RepoWithMeta[] = (reposRaw ?? []).map((r: { repo_meta?: unknown; repo_tags?: { tag: unknown }[] } & Record<string, unknown>) => ({
    ...(r as unknown as RepoWithMeta),
    repo_meta: Array.isArray(r.repo_meta) ? (r.repo_meta[0] ?? null) : (r.repo_meta as RepoWithMeta["repo_meta"]) ?? null,
    tags: ((r.repo_tags ?? []) as { tag: RepoWithMeta["tags"][number] }[]).map((rt) => rt.tag).filter(Boolean),
  }));

  // tag list for filter
  const allTags = Array.from(new Set(repos.flatMap((r) => r.tags.map((t) => t.name)))).sort();

  // filter
  const q = sp.q?.toLowerCase() ?? "";
  const statusFilter = sp.status && sp.status !== "all" ? sp.status : null;
  const tagFilter = sp.tag ?? null;
  const sort = sp.sort ?? "pushed_desc";

  let filtered = repos.filter((r) => {
    if (q) {
      const haystack = [r.name, r.description, r.ai_summary, r.repo_meta?.notes].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (statusFilter) {
      if (effectiveStatus(r, r.repo_meta) !== statusFilter) return false;
    }
    if (tagFilter) {
      if (!r.tags.some((t) => t.name === tagFilter)) return false;
    }
    return true;
  });

  filtered = filtered.sort((a, b) => {
    switch (sort) {
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "score_desc":
        return restartScore(b).total - restartScore(a).total;
      case "created_desc":
        return (new Date(b.created_at_gh ?? 0).getTime()) - (new Date(a.created_at_gh ?? 0).getTime());
      case "pushed_desc":
      default:
        return (new Date(b.pushed_at ?? 0).getTime()) - (new Date(a.pushed_at ?? 0).getTime());
    }
  });

  // summary panel — last 30 days
  const thirty = Date.now() - 30 * 86_400_000;
  const recentlyActive = repos.filter((r) => r.pushed_at && new Date(r.pushed_at).getTime() >= thirty).length;
  const recentlyCreated = repos.filter((r) => r.created_at_gh && new Date(r.created_at_gh).getTime() >= thirty).length;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <div className="flex items-center gap-3">
          <SyncButton />
          <SignOutButton />
        </div>
      </header>

      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 mb-4 text-sm text-gray-700">
        直近30日: <b>{recentlyActive}</b> active repos · <b>{recentlyCreated}</b> new repos · {repos.length} total
      </div>

      <div className="mb-4">
        <FilterBar tags={allTags} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-muted py-16 border border-dashed rounded-lg">
          {repos.length === 0 ? "まだ同期されていません。Sync now を押してください。" : "条件に合うリポジトリがありません。"}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </main>
  );
}
