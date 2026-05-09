"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import RepoEditor from "@/components/RepoEditor";
import SummaryRegen from "@/components/SummaryRegen";
import { effectiveStatus } from "@/lib/status";
import { restartScore } from "@/lib/score";
import { relativeTime } from "@/lib/relativeTime";
import { getAi, getMeta, loadRepos } from "@/lib/storage";
import type { AiSummary, RepoMeta, Repository } from "@/types/db";

export default function RepoDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const githubId = Number(id);
  const [repo, setRepo] = useState<Repository | null>(null);
  const [meta, setMetaState] = useState<RepoMeta | null>(null);
  const [ai, setAiState] = useState<AiSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const r = loadRepos().find((x) => x.github_id === githubId) ?? null;
    setRepo(r);
    setMetaState(getMeta(githubId));
    setAiState(getAi(githubId));
    setLoaded(true);
  }, [githubId]);

  if (!loaded) return null;
  if (!repo) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Link href="/dashboard" className="text-sm text-muted">← Back</Link>
        <p className="mt-4">リポジトリが見つかりません。先にダッシュボードでSyncしてください。</p>
      </main>
    );
  }

  const status = effectiveStatus(repo, meta);
  const score = restartScore(repo);

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <a
          href={repo.html_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-gray-900"
        >
          Open on GitHub <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex items-start gap-3 mb-4">
        {repo.is_private && <Lock className="w-4 h-4 mt-1 text-muted" />}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold break-words">{repo.full_name}</h1>
          {repo.description && <p className="text-muted mt-1">{repo.description}</p>}
        </div>
        <StatusBadge status={status} />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">AI Summary</h2>
          <SummaryRegen repo={repo} onUpdate={setAiState} />
        </div>
        <p className="text-sm text-gray-800">{ai?.summary ?? "(未生成)"}</p>
        {ai?.generated_at && (
          <p className="text-xs text-muted mt-1">Generated {relativeTime(ai.generated_at)}</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">Stats</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Last push</dt>
          <dd>{relativeTime(repo.pushed_at)}</dd>
          <dt className="text-muted">Created</dt>
          <dd>{relativeTime(repo.created_at_gh)}</dd>
          <dt className="text-muted">Language</dt>
          <dd>{repo.primary_language ?? "—"}</dd>
          <dt className="text-muted">Restart score</dt>
          <dd>
            <b>{score.total}</b>
            <span className="text-muted text-xs ml-2">
              README {score.readme} · lockfile {score.lockfile} · recency {score.recency}
            </span>
          </dd>
        </dl>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold mb-3">Manual</h2>
        <RepoEditor githubId={githubId} initialMeta={meta} onChange={setMetaState} />
      </section>
    </main>
  );
}
