"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import RepoCard from "@/components/RepoCard";
import FilterBar from "@/components/FilterBar";
import SyncButton from "@/components/SyncButton";
import { effectiveStatus } from "@/lib/status";
import { restartScore } from "@/lib/score";
import { contextHash, getSyncedAt, loadAllAi, loadRepos, saveRepos, setAi, summaryContext, withMeta } from "@/lib/storage";
import type { Repository } from "@/types/db";
import { useSearchParams } from "next/navigation";
import { relativeTime } from "@/lib/relativeTime";

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const params = useSearchParams();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRepos(loadRepos());
    setSyncedAt(getSyncedAt());
    setLoaded(true);
  }, []);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/repos");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const fresh: Repository[] = json.repos;
      saveRepos(fresh);
      setRepos(fresh);
      setSyncedAt(new Date().toISOString());

      const existingAi = loadAllAi();
      for (const r of fresh) {
        const ctx = summaryContext(r);
        const h = contextHash(ctx);
        const existing = existingAi[r.github_id];
        if (existing && existing.readme_hash === h) continue;
        fetch("/api/summarize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(ctx),
        })
          .then((r2) => r2.json())
          .then((j) => {
            if (j?.ok && j.summary) {
              setAi(r.github_id, { summary: j.summary, generated_at: new Date().toISOString(), readme_hash: h });
              setRepos((prev) => [...prev]);
            }
          })
          .catch(() => {});
      }
    } finally {
      setSyncing(false);
    }
  };

  const enriched = useMemo(() => withMeta(repos), [repos]);

  const allTags = useMemo(
    () => Array.from(new Set(enriched.flatMap((r) => r.meta?.tags ?? []))).sort(),
    [enriched],
  );

  const q = params.get("q")?.toLowerCase() ?? "";
  const statusFilter = params.get("status") && params.get("status") !== "all" ? params.get("status") : null;
  const tagFilter = params.get("tag");
  const sort = params.get("sort") ?? "pushed_desc";

  const filtered = useMemo(() => {
    let list = enriched.filter((r) => {
      if (q) {
        const haystack = [r.name, r.description, r.ai?.summary, r.meta?.notes].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter) {
        if (effectiveStatus(r, r.meta) !== statusFilter) return false;
      }
      if (tagFilter) {
        if (!r.meta?.tags?.includes(tagFilter)) return false;
      }
      return true;
    });
    list = list.sort((a, b) => {
      switch (sort) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "score_desc":
          return restartScore(b).total - restartScore(a).total;
        case "created_desc":
          return new Date(b.created_at_gh ?? 0).getTime() - new Date(a.created_at_gh ?? 0).getTime();
        default:
          return new Date(b.pushed_at ?? 0).getTime() - new Date(a.pushed_at ?? 0).getTime();
      }
    });
    return list;
  }, [enriched, q, statusFilter, tagFilter, sort]);

  const thirty = Date.now() - 30 * 86_400_000;
  const recentlyActive = enriched.filter((r) => r.pushed_at && new Date(r.pushed_at).getTime() >= thirty).length;
  const recentlyCreated = enriched.filter((r) => r.created_at_gh && new Date(r.created_at_gh).getTime() >= thirty).length;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <SyncButton onClick={sync} loading={syncing} />
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 mb-4 text-sm text-gray-700">
        直近30日: <b>{recentlyActive}</b> active · <b>{recentlyCreated}</b> new · {enriched.length} total
        {syncedAt && <span className="text-muted ml-3">last sync {relativeTime(syncedAt)}</span>}
      </div>

      <div className="mb-4">
        <FilterBar tags={allTags} />
      </div>

      {!loaded ? null : filtered.length === 0 ? (
        <div className="text-center text-muted py-16 border border-dashed rounded-lg">
          {enriched.length === 0
            ? "まだ同期されていません。Sync now を押してください。"
            : "条件に合うリポジトリがありません。"}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((repo) => (
            <RepoCard key={repo.github_id} repo={repo} />
          ))}
        </div>
      )}
    </main>
  );
}
