export interface ScoreInput {
  has_readme: boolean;
  has_lockfile: boolean;
  pushed_at: string | null;
}

export interface ScoreBreakdown {
  total: number;
  readme: number;
  lockfile: number;
  recency: number;
}

export function recencyPoints(pushed_at: string | null): number {
  if (!pushed_at) return 0;
  const days = (Date.now() - new Date(pushed_at).getTime()) / 86_400_000;
  if (days <= 14) return 30;
  if (days <= 90) return 20;
  if (days <= 365) return 10;
  return 0;
}

export function restartScore(input: ScoreInput): ScoreBreakdown {
  const readme = input.has_readme ? 40 : 0;
  const lockfile = input.has_lockfile ? 30 : 0;
  const recency = recencyPoints(input.pushed_at);
  return { total: readme + lockfile + recency, readme, lockfile, recency };
}
