import Link from "next/link";
import { Lock } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { effectiveStatus } from "@/lib/status";
import { restartScore } from "@/lib/score";
import { relativeTime } from "@/lib/relativeTime";
import type { RepoWithMeta } from "@/types/db";

export default function RepoCard({ repo }: { repo: RepoWithMeta }) {
  const status = effectiveStatus(repo, repo.repo_meta);
  const score = restartScore(repo).total;

  return (
    <Link
      href={`/repo/${repo.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {repo.is_private && <Lock className="w-3.5 h-3.5 text-muted shrink-0" />}
            <h3 className="font-semibold truncate">{repo.name}</h3>
          </div>
          {repo.description && (
            <p className="text-sm text-muted mt-1 line-clamp-1">{repo.description}</p>
          )}
          {repo.ai_summary && (
            <p className="text-sm text-gray-700 mt-1 line-clamp-1">▸ AI: {repo.ai_summary}</p>
          )}
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-muted">
        {repo.primary_language && <span>{repo.primary_language}</span>}
        <span>· {relativeTime(repo.pushed_at)}</span>
        <span>· Restart: {score}</span>
        {repo.tags?.map((t) => (
          <span key={t.id} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">#{t.name}</span>
        ))}
      </div>
    </Link>
  );
}
