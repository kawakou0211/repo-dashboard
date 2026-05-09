import { summarizeReadme } from "@/lib/claude";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, skipped: true, reason: "ANTHROPIC_API_KEY not set" });
  }
  const body = await req.json().catch(() => ({}));
  const excerpt = (body as { excerpt?: string }).excerpt;
  if (!excerpt) return NextResponse.json({ error: "excerpt required" }, { status: 400 });

  try {
    const summary = await summarizeReadme(excerpt);
    return NextResponse.json({ ok: true, summary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
