import { createRouteHandlerSupabase } from "@/lib/supabase/server";
import { countRecentCommits, listOwnerRepos, mapWithConcurrency } from "@/lib/github";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface ActivityRow {
  full_name: string;
  name: string;
  primary_language: string | null;
  commits: number;
  pushed_at: string | null;
  html_url: string;
}

export interface ActivityResponse {
  days: number;
  since: string;
  total_commits: number;
  active_repos: number;
  rows: ActivityRow[];
}

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: tokenRow } = await supabase
    .from("github_tokens")
    .select("token")
    .eq("user_id", user.id)
    .single();

  const token = tokenRow?.token;
  if (!token) {
    return NextResponse.json({ error: "GitHub token not found. Please sign in again." }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? 7)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    const repos = await listOwnerRepos(token);
    const rows = await mapWithConcurrency(repos, 5, async (r) => {
      const commits = await countRecentCommits(token, r.owner.login, r.name, since);
      return {
        full_name: r.full_name,
        name: r.name,
        primary_language: r.language,
        commits,
        pushed_at: r.pushed_at,
        html_url: r.html_url,
      } satisfies ActivityRow;
    });

    rows.sort((a, b) => b.commits - a.commits);
    const total_commits = rows.reduce((s, r) => s + r.commits, 0);
    const active_repos = rows.filter((r) => r.commits > 0).length;

    const body: ActivityResponse = { days, since, total_commits, active_repos, rows };
    return NextResponse.json(body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
