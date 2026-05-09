import { summarize } from "@/lib/gemini";
import type { SummaryContext } from "@/types/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, skipped: true, reason: "GEMINI_API_KEY not set" });
  }
  const body = await req.json().catch(() => ({}));
  const ctx = body as Partial<SummaryContext>;
  if (!ctx || !ctx.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const full: SummaryContext = {
    name: ctx.name,
    description: ctx.description ?? null,
    primary_language: ctx.primary_language ?? null,
    languages: ctx.languages ?? null,
    top_entries: ctx.top_entries ?? [],
    readme_excerpt: ctx.readme_excerpt ?? null,
  };

  try {
    const summary = await summarize(full);
    return NextResponse.json({ ok: true, summary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
