"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import RepoCard from "@/components/RepoCard";
import FilterBar from "@/components/FilterBar";
import SyncButton from "@/components/SyncButton";
import { restartScore } from "@/lib/score";
import { contextHash, getSyncedAt, loadAllAi, loadRepos, saveRepos, setAi, summaryContext, withMeta } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import type { Repository } from "@/types/db";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BarChart3, LogOut } from "lucide-react";
import { relativeTime } from "@/lib/relativeTime";
import { effectiveStatus, statusColor } from "@/lib/status";
import type { ActivityResponse } from "@/app/api/activity/route";
import type { EffectiveStatus, RepoWithMeta } from "@/types/db";

const STATUS_ORDER: EffectiveStatus[] = [
  "developing",
  "active",
  "paused",
  "dormant",
  "done",
  "idea",
  "stale",
  "archived",
];

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
  const [enriched, setEnriched] = useState<RepoWithMeta[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);

  useEffect(() => {
    async function init() {
      const [r, s] = await Promise.all([loadRepos(), getSyncedAt()]);
      setRepos(r);
      setSyncedAt(s);
      setLoaded(true);
    }
    init();
    fetch("/api/activity?days=7")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setActivity(j as ActivityResponse))
      .catch(() => {});
  }, []);

  useEffect(() => {
    withMeta(repos).then(setEnriched);
  }, [repos]);

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
      await saveRepos(fresh);
      setRepos(fresh);
      setSyncedAt(new Date().toISOString());

      const existingAi = await loadAllAi();
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
          .then(async (j) => {
            if (j?.ok && j.summary) {
              await setAi(r.github_id, { summary: j.summary, generated_at: new Date().toISOString(), readme_hash: h });
              setRepos((prev) => [...prev]);
            }
          })
          .catch(() => {});
      }
    } finally {
      setSyncing(false);
    }
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    location.href = "/login";
  };

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

  const statusCounts = useMemo(() => {
    const map = new Map<EffectiveStatus, number>();
    for (const r of enriched) {
      const s = effectiveStatus(r, r.meta);
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return STATUS_ORDER.map((s) => ({ status: s, count: map.get(s) ?? 0 })).filter((r) => r.count > 0);
  }, [enriched]);

  const staleCount = useMemo(() => {
    return enriched.filter((r) => {
      if (r.is_archived) return false;
      const m = r.meta?.manual_status;
      if (m === "done" || m === "archived" || m === "idea") return false;
      if (!r.pushed_at) return true;
      return Date.now() - new Date(r.pushed_at).getTime() > 90 * 86_400_000;
    }).length;
  }, [enriched]);

  const maxStatusCount = Math.max(1, ...statusCounts.map((s) => s.count));

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/report"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Report
          </Link>
          <SyncButton onClick={sync} loading={syncing} />
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold text-muted mb-2">Activity</div>
          <div className="grid grid-cols-4 gap-2 text-sm">
            <Stat label="commits 7d" value={activity?.total_commits ?? "—"} />
            <Stat label="active 30d" value={recentlyActive} />
            <Stat label="new 30d" value={recentlyCreated} />
            <Stat label="stale" value={staleCount} accent={staleCount > 0 ? "warn" : undefined} />
          </div>
          {syncedAt && <div className="text-xs text-muted mt-2">last sync {relativeTime(syncedAt)} · {enriched.length} total repos</div>}
        </div>
        <div>
          <div className="text-xs font-semibold text-muted mb-2">Status mix</div>
          {statusCounts.length === 0 ? (
            <p className="text-xs text-muted">—</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {statusCounts.map(({ status, count }) => (
                <li key={status} className="flex items-center gap-2">
                  <span className={`inline-block w-16 px-1 py-0.5 rounded text-center border ${statusColor(status)}`}>{status}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded">
                    <div className="h-full bg-gray-900 rounded" style={{ width: `${(count / maxStatusCount) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
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

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: "warn" }) {
  const accentCls = accent === "warn" ? "text-amber-700" : "text-gray-900";
  return (
    <div className="rounded border border-gray-200 px-2 py-1.5">
      <div className="text-[11px] text-muted leading-tight">{label}</div>
      <div className={`text-lg font-semibold tabular-nums leading-tight ${accentCls}`}>{value}</div>
    </div>
  );
}
