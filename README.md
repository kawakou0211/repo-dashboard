# repo-dashboard

自分のGitHubリポジトリを一覧化し、ステータス・タグ・メモ・(任意で)AI要約とともに管理する個人用ダッシュボード。

**完全無料・DB不要・認証不要** で動作します。
- リポジトリ情報は GitHub API から都度取得
- 手動メタデータ(ステータス/タグ/メモ)はブラウザの localStorage に保存
- AI要約は任意 (Google Gemini API の無料枠で動作)

## セットアップ

```bash
pnpm install
cp .env.local.example .env.local
```

### GitHub Personal Access Token を作成

1. https://github.com/settings/tokens (classic) → **Generate new token (classic)**
2. Scope: `repo` (private含む) と `read:user` をチェック
3. 生成されたトークンを `.env.local` の `GITHUB_TOKEN` に貼り付け

### (任意) Gemini API key

AI要約を使うなら https://aistudio.google.com/apikey でキーを発行し、`GEMINI_API_KEY` に設定。無料枠 (Gemini 2.5 Flash: 15req/min, 1500req/day) で十分動きます。空のままでも他は動きます。

## 開発

```bash
pnpm dev
```

http://localhost:3000 → 自動的に `/dashboard` へ。Sync now を押すとGitHubから取得開始。

## デプロイ

このアプリはローカル運用前提で、認証ガードがありません。Vercelにデプロイする場合は何らかの保護(Vercel Authentication 等)が必要です。
