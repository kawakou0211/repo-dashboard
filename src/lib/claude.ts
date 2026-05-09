import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

const SYSTEM = `あなたはGitHubリポジトリのREADMEから、そのプロジェクトが何をするものかを
1行(40〜80文字)の日本語で要約するアシスタントです。

制約:
- 1行のみ。改行・箇条書きは禁止。
- 「〜なアプリ」「〜するツール」のような体言止めまたは名詞句で終える。
- 推測ではなくREADMEに書かれている事実のみから要約する。
- READMEが空・意味不明な場合は "(要約不可)" と返す。`;

export async function summarizeReadme(excerpt: string): Promise<string> {
  if (!excerpt || excerpt.trim().length < 10) return "(要約不可)";
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `以下がREADMEの抜粋です:\n---\n${excerpt}\n---`,
      },
    ],
  });
  const block = res.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "";
  return text.trim().split("\n")[0] || "(要約不可)";
}
