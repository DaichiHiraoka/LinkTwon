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
- `lib/translationCache.js`: 翻訳対象抽出、翻訳API呼び出し、キャッシュ保存、キャッシュ参照
- `event-organizer-app/`: イベント主催者側の画面
- `store-app/`: 商店側の画面
- `shared.css`: 2つのアプリで共有する見た目
- `data/partner-data.json`: 主催者、商店、イベント、商品のデモデータ
- `data/translation-cache.json`: 翻訳キャッシュ保存先。実行時生成のため `.gitignore` 対象
- `data/translation-cache.example.json`: キャッシュ構造の例

## 翻訳API設定

環境変数 `TRANSLATION_API_URL` を指定すると、翻訳キャッシュ更新時に外部翻訳APIへPOSTする。

```powershell
$env:TRANSLATION_API_URL="https://example.com/translate"
$env:TRANSLATION_API_TOKEN="your-token"
npm --prefix partner-portals run dev
```

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
