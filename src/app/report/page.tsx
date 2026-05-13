"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { effectiveStatus, statusColor } from "@/lib/status";
import { restartScore } from "@/lib/score";
import { relativeTime } from "@/lib/relativeTime";
import { loadRepos, withMeta } from "@/lib/storage";
import type { EffectiveStatus, RepoWithMeta } from "@/types/db";
import type { ActivityResponse, ActivityRow } from "@/app/api/activity/route";
import type { TimelineResponse } from "@/app/api/timeline/route";

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

type Granularity = "day" | "week" | "month";

function formatLabel(label: string, gran: Granularity): string {
  if (gran === "month") {
    const [, m] = label.split("-");
    return `${parseInt(m)}月`;
  }
  if (gran === "week") {
    const [, m, d] = label.split("-");
    return `${parseInt(m)}/${parseInt(d)}~`;
  }
  const [, m, d] = label.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

export default function ReportPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [repos, setRepos] = useState<RepoWithMeta[]>([]);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [actLoading, setActLoading] = useState(false);
  const [actError, setActError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [tlLoading, setTlLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const r = await loadRepos();
      setRepos(await withMeta(r));
    }
    init();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setActLoading(true);
      setActError(null);
      setAiSummary(null);
      try {
        const res = await fetch(`/api/activity?days=${days}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setActError(json.error ?? `HTTP ${res.status}`);
          return;
        }
        setActivity(json as ActivityResponse);
      } finally {
        if (!cancelled) setActLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [days]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setTlLoading(true);
      setTimeline(null);
      try {
        const res = await fetch(`/api/timeline?days=${days}&granularity=${granularity}`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) setTimeline(json as TimelineResponse);
      } finally {
        if (!cancelled) setTlLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [days, granularity]);

  const generateAi = async () => {
    if (!activity) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/weekly-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(activity),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setAiSummary(`(失敗: ${j.error ?? j.reason ?? res.statusText})`);
        return;
      }
      setAiSummary(j.summary);
    } finally {
      setAiLoading(false);
    }
  };

  const statusCounts = useMemo(() => {
    const map = new Map<EffectiveStatus, number>();
    for (const r of repos) {
      const s = effectiveStatus(r, r.meta);
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return STATUS_ORDER.map((s) => ({ status: s, count: map.get(s) ?? 0 })).filter((r) => r.count > 0);
  }, [repos]);

  const stale = useMemo(() => {
    return repos
      .filter((r) => {
        if (r.is_archived) return false;
        const m = r.meta?.manual_status;
        if (m === "done" || m === "archived" || m === "idea") return false;
        if (!r.pushed_at) return true;
        return Date.now() - new Date(r.pushed_at).getTime() > 90 * 86_400_000;
      })
      .sort((a, b) => new Date(a.pushed_at ?? 0).getTime() - new Date(b.pushed_at ?? 0).getTime())
      .slice(0, 20);
  }, [repos]);

  const activityRows: ActivityRow[] = activity?.rows.filter((r) => r.commits > 0) ?? [];
  const totalRepos = repos.length;
  const maxStatusCount = Math.max(1, ...statusCounts.map((s) => s.count));

  const chartData = useMemo(() => {
    if (!timeline) return [];
    return timeline.points.map((p) => ({
      ...p,
      displayLabel: formatLabel(p.label, granularity),
    }));
  }, [timeline, granularity]);

  const btnBase = "px-3 py-1 rounded-md border text-sm";
  const btnActive = "bg-gray-900 text-white border-gray-900";
  const btnInactive = "bg-white border-gray-300 hover:bg-gray-50";

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="flex gap-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`${btnBase} ${days === d ? btnActive : btnInactive}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </header>

      <h1 className="text-2xl font-bold">Report</h1>

      {/* Chart */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">コミット推移</h2>
          <div className="flex gap-1">
            {(["day", "week", "month"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`${btnBase} text-xs ${granularity === g ? btnActive : btnInactive}`}
              >
                {g === "day" ? "日別" : g === "week" ? "週別" : "月別"}
              </button>
            ))}
          </div>
        </div>
        {tlLoading && (
          <div className="h-48 flex items-center justify-center text-sm text-muted">Loading…</div>
        )}
        {!tlLoading && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="displayLabel"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
                formatter={(v) => [v, "commits"]}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="commits" fill="#1f2937" radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {!tlLoading && chartData.length === 0 && (
          <p className="text-sm text-muted text-center py-8">データがありません。</p>
        )}
      </section>

      {/* Activity stats */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold mb-3">直近{days}日のアクティビティ</h2>
        {actLoading && <p className="text-sm text-muted">Loading…</p>}
        {actError && <p className="text-sm text-red-700">{actError}</p>}
        {activity && !actLoading && (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm mb-3">
              <Stat label="commits" value={activity.total_commits} />
              <Stat label="active repos" value={activity.active_repos} />
              <Stat label="total repos" value={totalRepos} />
            </div>
            {activityRows.length === 0 ? (
              <p className="text-sm text-muted">この期間にコミットされたリポジトリはありません。</p>
            ) : (
              <ul className="text-sm divide-y">
                {activityRows.map((r) => (
                  <li key={r.full_name} className="flex items-center justify-between py-1.5">
                    <a href={r.html_url} target="_blank" rel="noreferrer" className="hover:underline">
                      {r.name}
                    </a>
                    <span className="text-muted">
                      {r.primary_language ?? "—"} · <b className="text-gray-900">{r.commits}</b> commits
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* AI summary */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold inline-flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            AIナラティブサマリ
          </h2>
          <button
            onClick={generateAi}
            disabled={!activity || aiLoading}
            className="text-xs rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:opacity-60"
          >
            {aiLoading ? "Generating…" : "Generate"}
          </button>
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">
          {aiSummary ?? "Generate ボタンを押すとGeminiが文章でまとめます。"}
        </p>
      </section>

      {/* Status breakdown */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold mb-3">ステータス内訳 ({totalRepos} repos)</h2>
        {statusCounts.length === 0 ? (
          <p className="text-sm text-muted">データがありません。</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {statusCounts.map(({ status, count }) => (
              <li key={status} className="flex items-center gap-2">
                <span className={`inline-block w-20 px-1.5 py-0.5 rounded text-xs text-center border ${statusColor(status)}`}>
                  {status}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded">
                  <div
                    className="h-full bg-gray-900 rounded"
                    style={{ width: `${(count / maxStatusCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-gray-700">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stale repos */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold mb-3">放置アラート ({stale.length})</h2>
        {stale.length === 0 ? (
          <p className="text-sm text-muted">90日以上放置されているリポジトリはありません。</p>
        ) : (
          <ul className="text-sm divide-y">
            {stale.map((r) => (
              <li key={r.github_id} className="flex items-center justify-between py-1.5">
                <Link href={`/repo/${r.github_id}`} className="truncate hover:underline">
                  {r.name}
                </Link>
                <span className="text-muted text-xs">
                  last push {relativeTime(r.pushed_at)} · Restart {restartScore(r).total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-200 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
