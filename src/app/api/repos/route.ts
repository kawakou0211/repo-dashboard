import { fetchLanguages, fetchReadmeExcerpt, getServerToken, inspectRoot, listOwnerRepos, mapWithConcurrency } from "@/lib/github";
import type { Repository } from "@/types/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  let token: string;
  try {
    token = getServerToken();
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "no token" }, { status: 500 });
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
        homepage: r.homepage,
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
