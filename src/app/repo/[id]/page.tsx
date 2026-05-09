import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import RepoEditor from "@/components/RepoEditor";
import SummaryRegen from "@/components/SummaryRegen";
import { effectiveStatus } from "@/lib/status";
import { restartScore } from "@/lib/score";
import { relativeTime } from "@/lib/relativeTime";
import type { Repository, RepoMeta, Tag } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function RepoDetail({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  const { id } = await params;

  const { data: repo } = await supabase
    .from("repositories")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!repo) notFound();
  const r = repo as Repository;

  const { data: meta } = await supabase
    .from("repo_meta")
    .select("*")
    .eq("repository_id", id)
    .maybeSingle();

  const { data: repoTags } = await supabase
    .from("repo_tags")
    .select("tag:tags(*)")
    .eq("repository_id", id);
  const tags: Tag[] = ((repoTags ?? []) as { tag: Tag }[]).map((rt) => rt.tag).filter(Boolean);

  const { data: allTags } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", user.id);

  const status = effectiveStatus(r, meta as RepoMeta | null);
  const score = restartScore(r);

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <a
          href={r.html_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-gray-900"
        >
          Open on GitHub <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex items-start gap-3 mb-4">
        {r.is_private && <Lock className="w-4 h-4 mt-1 text-muted" />}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold break-words">{r.full_name}</h1>
          {r.description && <p className="text-muted mt-1">{r.description}</p>}
        </div>
        <StatusBadge status={status} />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">AI Summary</h2>
          <SummaryRegen repoId={r.id} />
        </div>
        <p className="text-sm text-gray-800">{r.ai_summary ?? "(未生成)"}</p>
        {r.ai_summary_at && (
          <p className="text-xs text-muted mt-1">Generated {relativeTime(r.ai_summary_at)}</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">Stats</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Last push</dt>
          <dd>{relativeTime(r.pushed_at)}</dd>
          <dt className="text-muted">Created</dt>
          <dd>{relativeTime(r.created_at_gh)}</dd>
          <dt className="text-muted">Language</dt>
          <dd>{r.primary_language ?? "—"}</dd>
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
        <RepoEditor
          repoId={r.id}
          userId={user.id}
          initialMeta={(meta as RepoMeta | null) ?? null}
          initialTags={tags}
          allUserTags={(allTags as Tag[]) ?? []}
        />
      </section>
    </main>
  );
}
