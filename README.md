# repo-dashboard

自分が過去に開発した GitHub リポジトリを一覧化し、ステータス・メモ・AI要約とともに管理するダッシュボード。詳細は [SPEC.md](./SPEC.md) を参照。

## セットアップ

```bash
pnpm install
cp .env.local.example .env.local   # 各種キーを記入
```

### Supabase

1. Supabase プロジェクト作成
2. SQL Editor で `supabase/migrations/0001_init.sql` を実行
3. Authentication → Providers → GitHub を有効化（scope: `repo read:user`）

### GitHub OAuth App

- Authorization callback URL: `https://<your-supabase>.supabase.co/auth/v1/callback`
- Client ID / Secret を Supabase Auth Provider に登録

### 環境変数

`.env.local` に記入。`ALLOWED_GITHUB_USER_ID` には自分の GitHub 数値ID を入れる:

```bash
curl https://api.github.com/users/<your-username> | jq .id
```

## 開発

```bash
pnpm dev
```

## デプロイ

Vercel に接続して環境変数を設定するだけ。
