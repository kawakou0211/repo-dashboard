import { NextResponse } from "next/server";
import type { ActivityRow } from "@/app/api/activity/route";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM = `あなたは個人開発者のGitHubアクティビティを分析し、
直近期間に何をやっていたかを2〜4文の日本語ナラティブで要約します。

入力には以下が含まれます:
- 期間(日数)
- リポジトリごとのコミット数・主要言語
- リポジトリ名のリスト

制約:
- 2〜4文。短く具体的に。
- 数字(コミット数、リポジトリ数)を盛り込む。
- 言語の偏りや「何系の作業が多かったか」を読み取る。
- データが空ならば "この期間は活動がありません。" と返す。`;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

interface Body {
  days: number;
  total_commits: number;
  active_repos: number;
  rows: ActivityRow[];
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, skipped: true, reason: "GEMINI_API_KEY not set" });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  if (body.total_commits === 0 || body.rows.length === 0) {
    return NextResponse.json({ ok: true, summary: "この期間は活動がありません。" });
  }

  const top = body.rows.filter((r) => r.commits > 0).slice(0, 10);
  const lines: string[] = [
    `期間: 直近${body.days}日`,
    `合計コミット: ${body.total_commits}件 / アクティブリポ: ${body.active_repos}件`,
    "",
    "リポジトリごとの内訳 (上位10件):",
    ...top.map((r) => `- ${r.name} (${r.primary_language ?? "?"}): ${r.commits} commits`),
  ];

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: lines.join("\n") }] }],
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 0.4,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    const json = (await res.json()) as GeminiResponse;
    if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return NextResponse.json({ ok: true, summary: text.trim() || "(要約不可)" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
