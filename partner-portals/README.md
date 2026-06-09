# LinkTwon Partner Portals

イベント主催者側と商店側のQR提示機能を、既存の住民向けfrontend/backendから分離した専用ディレクトリとして実装している。

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
- 管理者発行済みQRの画面表示
- QR PNG保存
- ブラウザ印刷によるPDF保存
- 商品・イベントなど可変コンテンツの翻訳キャッシュ参照
- 翻訳キャッシュの起動時更新、24時間ごとの定期更新、手動更新API

## 主要ファイル

- `server.js`: 専用画面配信、QR画像生成、翻訳キャッシュ更新API
- `lib/translationCache.js`: 翻訳対象抽出、翻訳API呼び出し、キャッシュ保存、キャッシュ参照
- `lib/qr.js`: QR PNG生成
- `event-organizer-app/`: イベント主催者側の画面
- `store-app/`: 商店側の画面
- `shared.css`: 2つのアプリで共有する見た目
- `data/partner-data.json`: 管理者発行済みQRを含むデモデータ
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
