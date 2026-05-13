import { createRouteHandlerSupabase } from "@/lib/supabase/server";
import { fetchCommitDates, listOwnerRepos, mapWithConcurrency } from "@/lib/github";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface TimelinePoint {
  label: string;
  commits: number;
}

export interface TimelineResponse {
  granularity: "day" | "week" | "month";
  points: TimelinePoint[];
  days: number;
}

function dayLabel(iso: string) {
  return iso.slice(0, 10);
}

function weekLabel(iso: string) {
  const d = new Date(iso);
  const diff = -((d.getUTCDay() + 6) % 7);
  const monday = new Date(d.getTime() + diff * 86_400_000);
  return monday.toISOString().slice(0, 10);
}

function monthLabel(iso: string) {
  return iso.slice(0, 7);
}

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: tokenRow } = await supabase
    .from("github_tokens")
    .select("token")
    .eq("user_id", user.id)
    .single();

  const token = tokenRow?.token;
  if (!token) return NextResponse.json({ error: "GitHub token not found" }, { status: 401 });

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? 30)));
  const gran = (url.searchParams.get("granularity") ?? "day") as "day" | "week" | "month";
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    const repos = await listOwnerRepos(token);
    const allDates: string[] = [];

    await mapWithConcurrency(repos, 5, async (r) => {
      const dates = await fetchCommitDates(token, r.owner.login, r.name, since);
      allDates.push(...dates);
    });

    const labelFn = gran === "day" ? dayLabel : gran === "week" ? weekLabel : monthLabel;

    const counts = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const label = labelFn(new Date(Date.now() - i * 86_400_000).toISOString());
      if (!counts.has(label)) counts.set(label, 0);
    }
    for (const date of allDates) {
      const label = labelFn(date);
      if (counts.has(label)) counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    const points: TimelinePoint[] = Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, commits]) => ({ label, commits }));

    return NextResponse.json({ granularity: gran, points, days } satisfies TimelineResponse);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
