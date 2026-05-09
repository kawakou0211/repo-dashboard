# Project Tracker — 仕様書

自分が過去に開発した GitHub リポジトリを一覧化し、ステータス・メモ・AI要約とともに管理するWebアプリ。

別セッションでこの仕様書を読み込めばゼロから実装を開始できることを目的とする。

---

## 1. 目的・背景

- 過去に作ったプロジェクトが増えてきて「これ何だっけ」「どこまでやったっけ」が分からなくなる。
- GitHubのリポジトリ一覧だけでは「ステータス」「再開しやすさ」「自分のメモ」が紐づかない。
- これらを一元管理するダッシュボードを自分用に作る。

## 2. スコープ

### やること
- 自分が owner の GitHub リポジトリ(Public + Private)を一覧表示
- 自動同期(GitHub API)
- 手動ステータス・タグ・メモ管理
- AI(Claude API)による README の1行要約
- 「再開しやすさスコア」の自動算出
- 検索・ソート・フィルタ
- 直近の開発アクティビティレポート

### やらないこと(初期スコープ外)
- ローカル(`~/`配下)の git リポジトリ走査 — **不要と決定**
- Fork/Star したリポジトリ
- 他人とのチーム共有(自分1人で使う)
- モバイル専用UI(レスポンシブ対応はする)

## 3. 技術スタック

| 層 | 技術 |
|---|---|
| Frontend / Backend | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth — GitHub OAuth Provider |
| Hosting | Vercel |
| External API | GitHub REST API (Octokit) |
| AI | Claude API (`@anthropic-ai/sdk`) — モデル: `claude-haiku-4-5-20251001` (要約は安く速く) |

## 4. 認証

- GitHub OAuth のみ。
- ログイン後、GitHub の user ID が許可リスト(自分のID 1件)と一致しない場合はセッションを破棄してログアウト。
- 許可ID は環境変数 `ALLOWED_GITHUB_USER_ID` で管理。
- Supabase Auth が発行する `provider_token` (GitHub access token) を以降の GitHub API 呼び出しに使う。スコープは `repo` (private含む) と `read:user`。

## 5. データモデル (Supabase / PostgreSQL)

すべてのテーブルに RLS を設定し、`user_id = auth.uid()` の行のみ操作可能とする。

### 5.1 `repositories` — GitHub から同期するリポジトリ本体

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | 内部ID |
| user_id | uuid FK → auth.users | 所有者 |
| github_id | bigint | GitHub の repo id |
| name | text | "my-app" |
| full_name | text | "kawakou/my-app" |
| description | text nullable | GitHub description |
| html_url | text | GitHubのURL |
| is_private | boolean | |
| is_fork | boolean | |
| is_archived | boolean | GitHub 上の archived フラグ |
| primary_language | text nullable | 主要言語 |
| pushed_at | timestamptz | 最終 push |
| created_at_gh | timestamptz | GitHub上の作成日 |
| updated_at_gh | timestamptz | |
| has_readme | boolean default false | README検出 |
| has_lockfile | boolean default false | lockfile検出 |
| readme_excerpt | text nullable | 先頭 8KB を保存 |
| ai_summary | text nullable | Claude 要約 |
| ai_summary_at | timestamptz nullable | 要約生成日時 |
| synced_at | timestamptz default now() | 最終同期日時 |

UNIQUE (user_id, github_id)

### 5.2 `repo_meta` — 手動編集領域(同期で上書きされない)

| カラム | 型 | 説明 |
|---|---|---|
| repository_id | uuid PK / FK → repositories | |
| manual_status | text | `developing` / `done` / `paused` / `archived` / `idea` |
| category | text | `web` / `cli` / `experiment` / `library` など自由 |
| notes | text | 自由記述メモ |
| updated_at | timestamptz default now() | |

### 5.3 `tags` / `repo_tags` — 多対多タグ

```sql
tags (id uuid PK, user_id uuid FK, name text, UNIQUE(user_id, name))
repo_tags (repository_id uuid FK, tag_id uuid FK, PRIMARY KEY both)
```

### 5.4 `sync_runs` — 同期ジョブ履歴

| カラム | 型 |
|---|---|
| id | uuid PK |
| user_id | uuid FK |
| started_at | timestamptz default now() |
| finished_at | timestamptz nullable |
| repo_count | int nullable |
| error | text nullable |

### 5.5 RLS ポリシー(全テーブル共通方針)

```sql
-- 例: repositories
alter table repositories enable row level security;
create policy "own rows" on repositories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

## 6. 算出系(DBに保存せず、表示時にサーバ側で計算)

### 6.1 activity_status (自動)
`now() - pushed_at` から:
- `< 14日` → `active`
- `< 90日` → `dormant`
- それ以上 → `stale`

### 6.2 effective_status (表示用の最終ステータス)
- `repo_meta.manual_status` があればそれを優先
- 無ければ `activity_status`
- `is_archived = true` は常に `archived` 扱い

### 6.3 restart_score (再開しやすさ、0-100)
```
score =
  (has_readme ? 40 : 0)
  + (has_lockfile ? 30 : 0)
  + recency_points  // pushed_at が新しいほど高い、0-30
```
recency_points:
- 14日以内: 30
- 90日以内: 20
- 365日以内: 10
- それ以上: 0

## 7. 同期フロー (GitHub → Supabase)

### トリガ
- ログイン直後(最後の `sync_runs.finished_at` から24h以上空いていれば自動)
- 一覧画面の `Sync now` ボタン

### 手順
1. `sync_runs` に開始レコード挿入
2. `GET /user/repos?affiliation=owner&per_page=100` をページング取得
3. 各 repo について並列(同時5件程度):
   - `GET /repos/{owner}/{repo}/readme` → 取得できれば `has_readme=true`、本文先頭8KBを `readme_excerpt`
   - `GET /repos/{owner}/{repo}/contents/` を見て lockfile 判定: `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` / `Pipfile.lock` / `poetry.lock` / `Gemfile.lock` / `Cargo.lock` / `go.sum` のいずれかが存在
4. `repositories` を upsert (key = github_id)
5. GitHub に存在しなくなった repo は `repositories` から削除(orphan cleanup)
6. `sync_runs.finished_at` / `repo_count` を更新

### AI要約の更新条件(別フロー、コスト節約)
- `readme_excerpt` が変化した、または `ai_summary` が NULL のレコードのみ
- バッチで Claude API を呼ぶ。プロンプトは下記参照。
- レート制限・失敗は許容(次回再試行)

## 8. AI 要約プロンプト

```
あなたはGitHubリポジトリのREADMEから、そのプロジェクトが何をするものかを
1行(40〜80文字)の日本語で要約するアシスタントです。

制約:
- 1行のみ。改行・箇条書きは禁止。
- 「〜なアプリ」「〜するツール」のような体言止めまたは名詞句で終える。
- 推測ではなく README に書かれている事実のみから要約する。
- README が空・意味不明な場合は "(要約不可)" と返す。

以下がREADMEの抜粋です:
---
{readme_excerpt}
---
```

`max_tokens: 200` 程度。

## 9. 画面仕様

### 9.1 ルーティング (App Router)

| パス | 内容 |
|---|---|
| `/` | 未ログイン: ランディング+「Sign in with GitHub」 / ログイン済: `/dashboard` へリダイレクト |
| `/dashboard` | リポジトリ一覧 |
| `/repo/[id]` | 詳細 |
| `/auth/callback` | OAuth コールバック |
| `/api/sync` | POST: 同期トリガ |
| `/api/summarize` | POST: AI要約バッチ実行 |

### 9.2 ダッシュボード `/dashboard`

**ヘッダー**
- タイトル "My Projects"
- `Sync now` ボタン(loadingスピナ表示)
- ユーザーアイコン(ログアウト)

**フィルタバー**
- 検索ボックス(タイトル / description / ai_summary / notes 横断)
- Status フィルタ(All / developing / done / paused / archived / idea / active / dormant / stale)
- Sort(Updated desc / Restart score desc / Name asc / Created desc)
- Tag フィルタ(複数選択可)

**サマリパネル**
- 直近30日でのアクティブ repo数 / コミット数 / 新規 repo数 を1行で表示

**カード一覧**
各カードに表示:
- リポジトリ名(クリックで詳細へ)
- ステータスバッジ(色分け)
- description (1行省略)
- AI要約(`▸ AI:` プレフィクスで1行)
- メタ情報行: 言語 · 最終push相対時間 · `Restart: NN` · タグチップ
- private repo は鍵アイコン

ステータス色:
- developing/active = 緑
- paused/dormant = 黄
- done = 青
- idea = 紫
- archived/stale = 灰

### 9.3 詳細 `/repo/[id]`

- 戻るボタン / 「Open on GitHub ↗」
- リポジトリ名
- 編集可能フィールド(オートセーブ、debounce 500ms):
  - manual_status (セレクト)
  - category (セレクト + 自由入力)
  - tags (チップ追加/削除)
  - notes (textarea)
- AI要約表示 + 「再生成」ボタン(該当repoのみClaude再呼び出し)
- Stats セクション: 最終push, restart score の内訳, 言語, 作成日

### 9.4 ログイン画面 `/`(未ログイン時)
- 中央に「Sign in with GitHub」ボタンのみ
- 許可外ユーザがログインした場合は、コールバック内でサインアウトしてエラーメッセージ表示

## 10. 環境変数

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # サーバー側ジョブ用

# GitHub OAuth (Supabase Auth Provider に登録)
# Supabase ダッシュボード側で設定する。アプリ側からは不要。

# 認可
ALLOWED_GITHUB_USER_ID=             # 自分の GitHub user id (数値)

# Claude
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

## 11. ディレクトリ構成(目安)

```
project-tracker/
├── SPEC.md                         # この文書
├── README.md
├── .env.local.example
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── supabase/
│   └── migrations/
│       └── 0001_init.sql           # 5章のスキーマ
├── src/
│   ├── app/
│   │   ├── page.tsx                # ランディング/ログイン
│   │   ├── dashboard/page.tsx
│   │   ├── repo/[id]/page.tsx
│   │   ├── auth/callback/route.ts
│   │   └── api/
│   │       ├── sync/route.ts
│   │       └── summarize/route.ts
│   ├── components/
│   │   ├── RepoCard.tsx
│   │   ├── FilterBar.tsx
│   │   ├── StatusBadge.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts
│   │   │   └── client.ts
│   │   ├── github.ts               # Octokit ラッパ
│   │   ├── claude.ts               # Anthropic SDK ラッパ
│   │   ├── score.ts                # restart_score 計算
│   │   └── status.ts               # activity_status / effective_status
│   └── types/
│       └── db.ts                   # Supabase 生成型
└── tsconfig.json
```

## 12. 実装ステップ(推奨順)

1. **プロジェクト初期化** — `create-next-app` + Tailwind + shadcn/ui
2. **Supabase プロジェクト作成** — マイグレーション `0001_init.sql` 適用
3. **GitHub OAuth 設定** — GitHub側で OAuth App 作成 → Supabase Auth Provider に登録
4. **認証フロー実装** — `/`、`/auth/callback`、許可ユーザチェック
5. **同期API実装** — `/api/sync` で GitHub→Supabase
6. **ダッシュボード実装** — 一覧・フィルタ・ソート・検索
7. **詳細画面実装** — 手動メタデータ編集
8. **AI要約実装** — `/api/summarize` バッチ + 詳細画面の再生成
9. **再開スコア / 直近レポート表示**
10. **Vercel デプロイ** — 環境変数設定、初回同期確認

各ステップ後に `pnpm dev` で動作確認。

## 13. 既知の検討事項 / 未決事項

- **同期の自動化**: 現状はログイン時 + 手動。Vercel Cron で1日1回自動同期に拡張する余地あり。
- **GitHub API レート制限**: 認証済み 5000req/h なので個人用では問題なし。lockfile判定で `contents/` を呼ぶのが repo数 × 1回かかるので、repo数が数百を超えたら `git/trees` API での一括取得に切り替え。
- **要約コスト**: Haiku で1要約あたり数円未満。新規/変更時のみ呼ぶ運用で十分。
- **削除されたrepoの扱い**: 同期時に orphan cleanup する方針だが、`repo_meta` の手動メモは消えてしまう。要望があれば「Trash」テーブルで論理削除に変える。
- **検索の実装**: 初期は ILIKE で十分。repo数が増えたら `pg_trgm` か Supabase の Full-Text Search に切り替え。

## 14. このセッションでの決定事項ログ

- データソース: GitHub のみ(自分owner の Public + Private)。ローカル走査は不要。
- ステータス: 自動(経過日数) + 手動ラベルの両立。手動が優先。
- 追加機能: AI要約 / タグ・カテゴリ / 検索 / 重複検出(GitHubのみなので実質不要だが remote URL ベースのキー設計は残す) / 再開しやすさスコア / 直近開発レポート。
- 運用: Vercel デプロイ前提。
- スタック: Next.js + Supabase + Vercel。
- 認証: GitHub OAuth のみ、許可ユーザIDで絞る。
