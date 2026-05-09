import type { SummaryContext } from "@/types/db";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM = `あなたはGitHubリポジトリの情報から、そのプロジェクトが何をするものかを
1行(40〜80文字)の日本語で要約するアシスタントです。

入力には以下が含まれます:
- リポジトリ名・description
- 言語比率(バイト数)
- トップレベルのファイル/ディレクトリ一覧
- README抜粋

これらを総合して何のプロジェクトかを推測してください。
READMEが薄くても、ファイル構成と言語からある程度判断してください。

制約:
- 1行のみ。改行・箇条書きは禁止。
- 「〜なアプリ」「〜するツール」のような体言止めまたは名詞句で終える。
- 完全に判断材料が無い場合のみ "(要約不可)" と返す。`;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

function buildPrompt(ctx: SummaryContext): string {
  const lines: string[] = [];
  lines.push(`# ${ctx.name}`);
  if (ctx.description) lines.push(`description: ${ctx.description}`);
  if (ctx.primary_language) lines.push(`primary language: ${ctx.primary_language}`);

  if (ctx.languages && Object.keys(ctx.languages).length) {
    const total = Object.values(ctx.languages).reduce((a, b) => a + b, 0) || 1;
    const pct = Object.entries(ctx.languages)
      .map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`)
      .join(", ");
    lines.push(`languages: ${pct}`);
  }

  if (ctx.top_entries.length) {
    lines.push(`top-level: ${ctx.top_entries.slice(0, 40).join(", ")}`);
  }

  lines.push("");
  lines.push("---- README ----");
  lines.push(ctx.readme_excerpt?.trim() || "(no README)");

  return lines.join("\n");
}

export async function summarize(ctx: SummaryContext): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const hasAnything = ctx.readme_excerpt || ctx.top_entries.length > 0 || ctx.description || ctx.primary_language;
  if (!hasAnything) return "(要約不可)";

  const prompt = buildPrompt(ctx);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  const json = (await res.json()) as GeminiResponse;
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text.trim().split("\n")[0] || "(要約不可)";
}
