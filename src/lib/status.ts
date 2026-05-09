import type { ActivityStatus, EffectiveStatus, ManualStatus, Repository, RepoMeta } from "@/types/db";

export function activityStatus(pushed_at: string | null): ActivityStatus {
  if (!pushed_at) return "stale";
  const days = (Date.now() - new Date(pushed_at).getTime()) / 86_400_000;
  if (days < 14) return "active";
  if (days < 90) return "dormant";
  return "stale";
}

export function effectiveStatus(repo: Pick<Repository, "is_archived" | "pushed_at">, meta: Pick<RepoMeta, "manual_status"> | null): EffectiveStatus {
  if (repo.is_archived) return "archived";
  const manual = meta?.manual_status as ManualStatus | null | undefined;
  if (manual) return manual;
  return activityStatus(repo.pushed_at);
}

const COLORS: Record<EffectiveStatus, string> = {
  developing: "bg-green-100 text-green-800 border-green-200",
  active: "bg-green-100 text-green-800 border-green-200",
  paused: "bg-yellow-100 text-yellow-800 border-yellow-200",
  dormant: "bg-yellow-100 text-yellow-800 border-yellow-200",
  done: "bg-blue-100 text-blue-800 border-blue-200",
  idea: "bg-purple-100 text-purple-800 border-purple-200",
  archived: "bg-gray-100 text-gray-700 border-gray-200",
  stale: "bg-gray-100 text-gray-700 border-gray-200",
};

export function statusColor(s: EffectiveStatus): string {
  return COLORS[s];
}
