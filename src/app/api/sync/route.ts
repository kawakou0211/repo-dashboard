import { createClient } from "@/lib/supabase/server";
import { detectLockfile, fetchReadmeExcerpt, listOwnerRepos, mapWithConcurrency } from "@/lib/github";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();
  if (!session || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = session.provider_token;
  if (!token) return NextResponse.json({ error: "no provider token; please re-login" }, { status: 401 });

  const { data: run, error: runErr } = await supabase
    .from("sync_runs")
    .insert({ user_id: user.id })
    .select()
    .single();
  if (runErr || !run) return NextResponse.json({ error: runErr?.message }, { status: 500 });

  try {
    const repos = await listOwnerRepos(token);

    const enriched = await mapWithConcurrency(repos, 5, async (r) => {
      const [excerpt, hasLock] = await Promise.all([
        fetchReadmeExcerpt(token, r.owner.login, r.name).catch(() => null),
        detectLockfile(token, r.owner.login, r.name).catch(() => false),
      ]);
      return {
        user_id: user.id,
        github_id: r.id,
        name: r.name,
        full_name: r.full_name,
        description: r.description,
        html_url: r.html_url,
        is_private: r.private,
        is_fork: r.fork,
        is_archived: r.archived,
        primary_language: r.language,
        pushed_at: r.pushed_at,
        created_at_gh: r.created_at,
        updated_at_gh: r.updated_at,
        has_readme: !!excerpt,
        has_lockfile: hasLock,
        readme_excerpt: excerpt,
        synced_at: new Date().toISOString(),
      };
    });

    if (enriched.length) {
      const { error: upsertErr } = await supabase
        .from("repositories")
        .upsert(enriched, { onConflict: "user_id,github_id" });
      if (upsertErr) throw upsertErr;
    }

    // orphan cleanup
    const ghIds = enriched.map((r) => r.github_id);
    if (ghIds.length) {
      const { data: existing } = await supabase
        .from("repositories")
        .select("id, github_id")
        .eq("user_id", user.id);
      const stale = (existing ?? []).filter((row) => !ghIds.includes(row.github_id));
      if (stale.length) {
        await supabase.from("repositories").delete().in("id", stale.map((s) => s.id));
      }
    }

    await supabase
      .from("sync_runs")
      .update({ finished_at: new Date().toISOString(), repo_count: enriched.length })
      .eq("id", run.id);

    return NextResponse.json({ ok: true, count: enriched.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    await supabase
      .from("sync_runs")
      .update({ finished_at: new Date().toISOString(), error: msg })
      .eq("id", run.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
