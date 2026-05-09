const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM = `あなたはGitHubリポジトリのREADMEから、そのプロジェクトが何をするものかを
1行(40〜80文字)の日本語で要約するアシスタントです。

制約:
- 1行のみ。改行・箇条書きは禁止。
- 「〜なアプリ」「〜するツール」のような体言止めまたは名詞句で終える。
- 推測ではなくREADMEに書かれている事実のみから要約する。
- READMEが空・意味不明な場合は "(要約不可)" と返す。`;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export async function summarizeReadme(excerpt: string): Promise<string> {
  if (!excerpt || excerpt.trim().length < 10) return "(要約不可)";
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `以下がREADMEの抜粋です:\n---\n${excerpt}\n---` }] }],
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
