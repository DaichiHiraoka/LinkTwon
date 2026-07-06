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

## ローカルDB

partner-portals はローカル実行時に SQLite DB を使う。初回起動時に `data/partner-data.json` のモックデータを `data/partner-portal.sqlite` へ投入し、以後はAPIがSQLiteから読み出す。

- 読み出し: 主催者、商店、イベント、商品、カテゴリ
- 書き込み: イベント受付結果、商品交換結果、QRで提示された利用者情報

DBの場所は環境変数で変更できる。

```powershell
$env:PARTNER_SQLITE_PATH="C:\tmp\partner-portal.sqlite"
npm --prefix partner-portals run dev:event
```

将来 Aiven MySQL に置き換える場合は、`lib/partnerRepository.js` のリポジトリ境界をMySQL実装に差し替える想定。アプリ/API側は `readPartnerData`、`recordEventCheckIn`、`recordStoreExchange` を呼ぶだけにしている。

## Vercelデプロイ

`partner-portals` は1つのコードベースを `PARTNER_APP_ROLE` で切り替えているため、Vercelではイベント主催者用と商店用を別プロジェクトとしてGit連携する。

| Project | URL | Root Directory | Production Branch | Environment |
|---|---|---|---|---|
| `linktown-event-portal` | https://linktown-event-portal.vercel.app/ | `partner-portals` | `main` | `PARTNER_APP_ROLE=event`, `PARTNER_SQLITE_PATH=/tmp/linktown-event-portal.sqlite` |
| `linktown-store-portal` | https://linktown-store-portal.vercel.app/ | `partner-portals` | `main` | `PARTNER_APP_ROLE=store`, `PARTNER_SQLITE_PATH=/tmp/linktown-store-portal.sqlite` |

Vercelのサーバーレス関数ではリポジトリ内にSQLiteを書き込めないため、未指定時の書き込み先は `/tmp` 配下になる。これはデモ・検証用の一時DBであり、受付/交換履歴の永続保存が必要な本番運用では、`lib/partnerRepository.js` をAiven MySQLなどの永続DB実装へ差し替える。

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
- `lib/partnerRepository.js`: SQLite schema、モックデータseed、主催者/商店データ読み出し、受付/交換結果の書き込み
- `lib/translationCache.js`: 翻訳対象抽出、翻訳API呼び出し、キャッシュ保存、キャッシュ参照
- `event-organizer-app/`: イベント主催者側の画面
- `store-app/`: 商店側の画面
- `shared.css`: 2つのアプリで共有する見た目
- `data/partner-data.json`: SQLite初期投入用のモックデータ
- `data/partner-portal.sqlite`: ローカル実行時に生成されるSQLite DB。実行時生成のため `.gitignore` 対象
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
