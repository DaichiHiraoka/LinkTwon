# LinkTwon Partner Portals

イベント主催者側と商店側が、エンドユーザーのアプリに表示された本人確認QRを読み取るための専用アプリを実装している。

## 起動

```powershell
npm --prefix partner-portals install
npm run dev
```

ルートの `npm run dev` で以下を同時起動する。

- イベント主催者アプリ: `http://localhost:5181/`
- 商店アプリ: `http://localhost:5182/`

個別起動もできる。

```powershell
npm --prefix partner-portals run dev:event
npm --prefix partner-portals run dev:store
```

## デモ用アクセスコード

- イベント主催者: `event-demo`
- 商店: `store-demo`

## DB接続

partner-portals は、イベント主催者・商店・イベント・商品・カテゴリをDBから読み込み、受付/交換結果をメインDBへ書き込む。ローカルでは backend と同じ SQLite を共有し、本番/staging では backend と同じ永続 MySQL/Aiven DB に接続する。

- 読み出し: `event_organizers`、`event_organizer_events`、`stores`、`events`、`services`、`service_categories`
- イベント受付書き込み: `participations`、`users.points`、`point_transactions`、`portal_event_check_ins`
- 商店交換書き込み: `users.points`、`point_transactions`、`portal_store_exchanges`

ローカル開発は `partner-portals/.env.development` の既定で `../backend/database/dev.sqlite` を使う。初回起動時のdemo seedが必要な場合は `PARTNER_SEED_DEMO_DATA=true` を設定する。

```powershell
$env:PARTNER_DB_CLIENT="sqlite"
$env:PARTNER_DB_PATH="..\backend\database\dev.sqlite"
$env:PARTNER_SEED_DEMO_DATA="true"
npm --prefix partner-portals run dev:event
```

本番/staging は SQLite や `data/partner-data.json` には接続しない。事前に MySQL migration を適用し、各Vercelプロジェクトに `PARTNER_DB_CLIENT=mysql` と `PARTNER_DATABASE_URL` を設定する。

```powershell
npm --prefix backend run db:migrate:mysql
```

## Vercelデプロイ

`partner-portals` は1つのコードベースを `PARTNER_APP_ROLE` で切り替えているため、Vercelではイベント主催者用と商店用を別プロジェクトとしてGit連携する。

| Project | URL | Root Directory | Production Branch | Environment |
|---|---|---|---|---|
| `linktown-event-portal` | https://linktown-event-portal.vercel.app/ | `partner-portals` | `main` | `PARTNER_APP_ROLE=event`, `PARTNER_DB_CLIENT=mysql`, `PARTNER_DATABASE_URL=...` |
| `linktown-store-portal` | https://linktown-store-portal.vercel.app/ | `partner-portals` | `main` | `PARTNER_APP_ROLE=store`, `PARTNER_DB_CLIENT=mysql`, `PARTNER_DATABASE_URL=...` |

`APP_ENV=production` または `APP_ENV=staging` では `PARTNER_DB_CLIENT=mysql` と `PARTNER_DATABASE_URL` が必須。設定されていない場合は起動時に失敗する。

## デモログイン

| アプリ | ID | パスワード |
|---|---|---|
| イベント主催者 | `event-demo` | `event-demo-pass` |
| 商店 | `store-demo` | `store-demo-pass` |

## 実装範囲

- イベント主催者アプリでのアクセスコード入力
- 商店アプリでのアクセスコード入力
- エンドユーザー提示QRのカメラ読取
- カメラ未対応環境向けのQR内容手入力
- イベント受付確定
- 商品交換確定
- 商品・イベントなど可変コンテンツの翻訳キャッシュ参照
- 翻訳キャッシュの起動時更新、24時間ごとの定期更新、手動更新API

## 主要ファイル

- `server.js`: 専用画面配信、ユーザーQR検証、受付/交換API、翻訳キャッシュ更新API
- `lib/partnerRepository.js`: SQLite/MySQL接続、主催者/商店データ読み出し、受付/交換結果のメインDB書き込み
- `lib/translationCache.js`: 翻訳対象抽出、翻訳API呼び出し、キャッシュ保存、キャッシュ参照
- `event-organizer-app/`: イベント主催者側の画面
- `store-app/`: 商店側の画面
- `shared.css`: 2つのアプリで共有する見た目
- `data/partner-data.json`: テスト/ローカルseed専用のfixture。本番デプロイには同梱しない
- `../backend/database/dev.sqlite`: ローカル開発時に共有するSQLite DB。実行時生成のため `.gitignore` 対象
- `data/translation-cache.json`: 翻訳キャッシュ保存先。実行時生成のため `.gitignore` 対象
- `data/translation-cache.example.json`: キャッシュ構造の例

## 翻訳API設定

環境変数 `TRANSLATION_API_URL` を指定すると、翻訳キャッシュ更新時に外部翻訳APIへPOSTする。ローカルで backend の共通翻訳キャッシュを使う場合は `http://localhost:3000/api/translations/translate` を指定する。

```powershell
$env:TRANSLATION_API_URL="http://localhost:3000/api/translations/translate"
npm --prefix partner-portals run dev
```

backend 側で `TRANSLATION_REFRESH_KEY` を設定している場合は、同じ値を `TRANSLATION_API_TOKEN` に設定する。partner-portals は既存の Bearer に加えて `x-refresh-key` も送信する。

送信形式:

```json
{
  "source_locale": "ja",
  "target_locale": "en",
  "text": "翻訳対象文",
  "content_type": "event",
  "content_id": "event-001",
  "field_name": "event_name"
}
```

応答は `translated_text` または `translation` を読む。API設定がないローカル環境では、開発用の疑似プロバイダでキャッシュを作成する。

## 手動更新API

```powershell
Invoke-RestMethod -Method Post http://localhost:5181/api/translations/refresh
```

`PARTNER_REFRESH_KEY` を設定した場合は、`x-refresh-key` ヘッダーに同じ値を付けたリクエストのみ受け付ける。

## QR読取方式

住民向け `frontend/` のQRタブで本人確認QRを表示し、イベント主催者アプリまたは商店アプリがそのQRを読み取る。

- イベント主催者アプリ: `POST /api/event/check-ins`
- 商店アプリ: `POST /api/store/exchanges`

QRには `user_id`、表示名、発行時刻、有効期限、nonce を含める。認証トークンやパスワードは含めない。
