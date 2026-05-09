import { createClient } from "@/lib/supabase/server";
import { summarizeReadme } from "@/lib/claude";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: true, skipped: true, reason: "ANTHROPIC_API_KEY not set" });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const repoId = (body as { repository_id?: string }).repository_id;

  let query = supabase
    .from("repositories")
    .select("id, readme_excerpt, ai_summary")
    .eq("user_id", user.id);

  if (repoId) {
    query = query.eq("id", repoId);
  } else {
    query = query.is("ai_summary", null);
  }

  const { data: rows, error } = await query.limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let updated = 0;
  for (const row of rows ?? []) {
    if (!row.readme_excerpt) continue;
    try {
      const summary = await summarizeReadme(row.readme_excerpt);
      await supabase
        .from("repositories")
        .update({ ai_summary: summary, ai_summary_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", user.id);
      updated++;
    } catch {
      // skip; will retry next run
    }
  }

  return NextResponse.json({ ok: true, updated });
}
