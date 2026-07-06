# デプロイ構成ドキュメント

このファイルはローカル開発・Codex等へのコンテキスト共有を目的として、本番で使用している全サービスと環境変数を記述します。

---

## 1. サービス一覧

| 役割 | サービス名 | URL / 補足 |
|---|---|---|
| **フロントエンド ホスティング** | Vercel | https://link-twon.vercel.app/ |
| **バックエンド ホスティング** | Render (Free tier, Web Service) | https://linktwon-backend.onrender.com |
| **データベース** | PlanetScale 互換 MySQL (Render上の外部MySQL) | `DATABASE_URL` 参照 |
| **メール送信** | Resend | https://resend.com — ドメイン `linktown.site` で認証済み |
| **ドメイン** | Namecheap で購入した `linktown.site` | DNS は Cloudflare に移管済み |
| **DNS管理** | Cloudflare | ネームサーバー: `piers.ns.cloudflare.com` / `ryleigh.ns.cloudflare.com` |
| **CI** | GitHub Actions | `.github/workflows/ci.yml` — backend smoke test + frontend build + partner-portals test |
| **ソースコード** | GitHub | https://github.com/DaichiHiraoka/LinkTwon |

---

## 2. バックエンド環境変数（Render）

Render Dashboard の linktwon-backend > Environment に設定済み。

```
# アプリ設定
NODE_ENV=production
PORT=3000

# データベース
DB_CLIENT=mysql
DATABASE_URL=mysql://<user>:<password>@<host>/<dbname>?ssl-mode=REQUIRED
MYSQL_SSL=true
MYSQL_SSL_REJECT_UNAUTHORIZED=false

# JWT
JWT_SECRET=<secret>
JWT_EXPIRES_IN=7d

# CORS / フロントエンドURL
FRONTEND_ORIGIN=https://link-twon.vercel.app
FRONTEND_BASE_URL=https://link-twon.vercel.app

# メール (Resend)
MAIL_DRIVER=resend
RESEND_API_KEY=<resend_api_key>
SMTP_FROM=noreply@linktown.site

# SMTP予備設定（MAIL_DRIVER=resend のため実際には使用しない）
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=<resend_api_key>
SMTP_TLS_REJECT_UNAUTHORIZED=false

# メールトークン露出制御
MAIL_EXPOSE_RESET_TOKEN=false        # 本番は必ず false
MAIL_EXPOSE_VERIFICATION_TOKEN=false # 本番は必ず false

# トークン有効期限
EMAIL_VERIFICATION_EXPIRES_MINUTES=1440  # 24時間
PASSWORD_RESET_EXPIRES_MINUTES=30

# デモデータ自動シード
AUTO_SEED_DEMO_DATA=false
```

---

## 3. フロントエンド環境変数（Vercel）

Vercel Dashboard の link-twon > Settings > Environment Variables に設定済み。

```
VITE_API_BASE_URL=https://linktwon-backend.onrender.com
```

ローカル開発では `frontend/.env.local` に記述するか、`vite.config.ts` の proxy 設定が
バックエンドへ自動的にプロキシするため不要（デフォルトは `http://127.0.0.1:3000`）。

---

## 4. ローカル開発環境構築

### 4-1. 前提条件

- Node.js v22 以上
- ルートで `npm install`（concurrently 等の devDependencies）

### 4-2. バックエンド DB 設定

ローカルでは **SQLite を自動使用**するため追加設定不要。
起動時に `backend/database/dev.sqlite` が自動生成され、スキーマとデモデータが投入される。

MySQL を使いたい場合はルートまたは `backend/` に `.env` を作成し:
```
DB_CLIENT=mysql
DATABASE_URL=mysql://root:password@127.0.0.1:3306/linktown
```

### 4-3. メール設定（ローカル）

**メールを実際に送らない場合（推奨）:**
```
MAIL_DRIVER=console   # ターミナルにメール内容を出力
```

**Resend を使ってローカルからも本物のメールを送る場合:**
```
MAIL_DRIVER=resend
RESEND_API_KEY=<resend_api_key>
SMTP_FROM=noreply@linktown.site
```

**メールを使わずにトークンをAPIレスポンスに含める場合（開発・テスト専用）:**
```
MAIL_DRIVER=console
MAIL_EXPOSE_VERIFICATION_TOKEN=true
MAIL_EXPOSE_RESET_TOKEN=true
```
> ⚠️ `MAIL_EXPOSE_*_TOKEN=true` は本番環境で絶対に使用しないこと。

### 4-4. .env ファイルの配置場所

コードは以下の順で `.env` を探す（`backend/config/loadEnv.js`）:
1. リポジトリルート (`/`)
2. `backend/`

ローカルでは **ルートに `.env`** を置くのが最も簡単。

### 4-5. 起動コマンド

```bash
# 初回のみ
npm install

# 全サービス同時起動（backend + frontend + partner-portals × 2）
npm run dev

# 個別起動
npm run dev:backend        # http://localhost:3000
npm run dev:frontend       # http://localhost:5173
npm run dev:event-portal   # http://localhost:5181
npm run dev:store-portal   # http://localhost:5182
```

---

## 5. デプロイフロー

```
main ブランチへの push
  ↓
GitHub Actions CI (ci.yml)
  ↓ backend smoke test + frontend build (tsc + vite build) + partner-portals test
  ↓ 成功したら
Render: mainブランチの変更を自動検知して自動デプロイ
Vercel: mainブランチの変更を自動検知して自動デプロイ
```

> ⚠️ **Render Free プランの制約:**
> - 15分以上アクセスがないとスリープする（復帰に約50秒かかる）
> - SMTPポート（25/465/587）への外部接続がブロックされる → そのため MAIL_DRIVER=resend (HTTPS API) を使用

---

## 6. サービス別の補足

### Resend
- ドメイン認証: `linktown.site` が Verified 済み
- 送信元アドレス: `noreply@linktown.site`
- Resend ダッシュボード: https://resend.com/domains

### Cloudflare
- `linktown.site` の DNS 管理
- MXレコード: Resend が要求するレコードを設定済み

### Render
- サービスID: `srv-d8js7s57vvec73e2r9g0`
- Plan: Free
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `node server.js`

### Vercel
- プロジェクト名: `link-twon`
- Framework: Vite (React)
- Root Directory: `frontend`
- Build Command: `npm run build`

### GitHub Actions
- トリガー: `main` / `dev` ブランチへの push / PR
- テスト内容:
  - `backend`: smoke test (`node scripts/smokeTest.js`)
  - `frontend`: TypeScript チェック + Vite ビルド (`tsc --noEmit && vite build`)
  - `partner-portals`: smoke test (`node test/smoke-test.js`)
