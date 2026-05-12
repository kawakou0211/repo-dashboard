import { createRouteHandlerSupabase } from "@/lib/supabase/server";
import { fetchLanguages, fetchReadmeExcerpt, inspectRoot, listOwnerRepos, mapWithConcurrency } from "@/lib/github";
import type { Repository } from "@/types/db";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerSupabase(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.provider_token;
  if (!token) {
    return NextResponse.json({ error: "GitHub token not found. Please sign in again." }, { status: 401 });
  }

  try {
    const ghRepos = await listOwnerRepos(token);

    const enriched: Repository[] = await mapWithConcurrency(ghRepos, 5, async (r) => {
      const [excerpt, root, languages] = await Promise.all([
        fetchReadmeExcerpt(token, r.owner.login, r.name).catch(() => null),
        inspectRoot(token, r.owner.login, r.name).catch(() => ({ hasLockfile: false, entries: [] as string[] })),
        fetchLanguages(token, r.owner.login, r.name).catch(() => null),
      ]);
      return {
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
        has_lockfile: root.hasLockfile,
        readme_excerpt: excerpt,
        top_entries: root.entries,
        languages,
      };
    });

    return NextResponse.json({ repos: enriched });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
