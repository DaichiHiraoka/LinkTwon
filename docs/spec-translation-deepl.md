# 仕様書: DeepL API 統合と翻訳キャッシュの backend 移行

対象リポジトリ: `LinkTwon`
ステータス: 確定仕様(実装未着手)
前提: 翻訳プロバイダは **DeepL API Free** を既定とする。翻訳結果は必ずキャッシュし、原文が変わった場合のみ再翻訳する(文字数消費を最小化)。

---

## 1. 全体アーキテクチャ

```
[frontend]  --GET /events?locale=en 等-->  [backend]
                                              |  キャッシュヒット → DBから返す
                                              |  ミス → DeepL API 呼び出し → DBに保存
[partner-portals] --POST /api/translations/translate--> [backend](同じキャッシュを共有)
```

- 翻訳の実行とキャッシュの正本は **メイン backend に一元化**する。
- partner-portals は自前で DeepL を呼ばず、既存の `TRANSLATION_API_URL` の仕組みで backend の翻訳エンドポイントを叩く(partner-portals 側のコード変更は原則不要。env 設定のみ)。
- キャッシュキーは `content_type : content_id : field_name : target_locale`。原文の SHA-256 ハッシュ(`source_text_hash`)が一致する限り再翻訳しない。この方式は `partner-portals/lib/translationCache.js` の既存設計を踏襲する。

## 2. 環境変数(backend/config/env.js に追加)

| 変数 | 必須 | 既定値 | 説明 |
|---|---|---|---|
| `TRANSLATION_PROVIDER` | 任意 | `DEEPL_API_KEY` があれば `deepl`、なければ `mock` | `deepl` / `mock` |
| `DEEPL_API_KEY` | provider=deepl 時必須 | なし | DeepL 認証キー |
| `DEEPL_API_URL` | 任意 | `https://api-free.deepl.com/v2/translate` | Pro 移行時に差し替え可能にする |
| `TRANSLATION_REFRESH_KEY` | 任意 | なし | refresh/translate エンドポイントの保護キー |

- `.env.example` に上記4つを追記すること。
- `DEEPL_API_KEY` はログに出力しないこと。

## 3. DB スキーマ追加

`backend/database/schema.sql`(MySQL)と `backend/database/sqlite.js`(SQLite)の両方に追加する。

```sql
CREATE TABLE content_translations (
  translation_id INT AUTO_INCREMENT PRIMARY KEY,
  content_type VARCHAR(50) NOT NULL,      -- 'event' | 'service' | 'store' など
  content_id VARCHAR(50) NOT NULL,
  field_name VARCHAR(100) NOT NULL,       -- 'event_name', 'location', 'service_name', 'store_name' など
  source_locale VARCHAR(10) NOT NULL DEFAULT 'ja',
  target_locale VARCHAR(10) NOT NULL,
  source_text_hash CHAR(64) NOT NULL,     -- 原文の SHA-256 hex
  translated_text TEXT NOT NULL,
  translation_provider VARCHAR(50) NOT NULL,   -- 'deepl' | 'mock' | 'source'
  translation_status ENUM('current', 'failed') NOT NULL DEFAULT 'current',
  error_message VARCHAR(255) NULL,
  translated_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_translation (content_type, content_id, field_name, target_locale)
);
```

- SQLite 側は `AUTO_INCREMENT` → `AUTOINCREMENT`、`ENUM` → `TEXT` + CHECK 制約に読み替える(既存テーブルの書き方に合わせる)。
- 外部キーは張らない(content_id は events/services/stores を横断するため)。

## 4. 翻訳サービスモジュール(新規)

`backend/services/translationService.js` を新規作成。`partner-portals/lib/translationCache.js` のロジックを移植するが、保存先を JSON ファイルから DB に変更する。

### 4.1 公開関数

```js
// テキスト1件を翻訳(キャッシュ優先)。全API応答加工の基本単位
async function translateText({ contentType, contentId, fieldName, sourceText, targetLocale })
// → { translatedText, provider, cached: boolean }

// レコード配列の指定フィールドを一括ローカライズ(events/services 一覧用)
async function localizeRows(rows, fieldConfig, targetLocale)
// fieldConfig 例: { contentType: 'event', idField: 'event_id', fields: ['event_name', 'location'] }

// 全対象コンテンツの翻訳を事前生成(refresh 用)
async function refreshTranslations({ force = false })
// → { records, translated, skipped, failed }
```

### 4.2 動作仕様

1. `targetLocale === 'ja'`(source と同じ)なら原文をそのまま返す。DBアクセスもしない。
2. キャッシュ照会: unique key で1件取得し、`translation_status = 'current'` かつ `source_text_hash` が現在の原文ハッシュと一致すれば `translated_text` を返す(**DeepL を呼ばない**)。
3. ミス時: provider で翻訳 → `INSERT ... ON DUPLICATE KEY UPDATE`(SQLite は `INSERT ... ON CONFLICT ... DO UPDATE`)で upsert して返す。
4. 翻訳失敗時: 既存キャッシュがあれば古い翻訳を返す。なければ**原文を返す**(エラーでリクエストを落とさない)。`translation_status = 'failed'` と `error_message` を記録。
5. 空文字・null のフィールドは翻訳対象外。

### 4.3 DeepL provider 仕様

- エンドポイント: `POST ${DEEPL_API_URL}`
- ヘッダ: `Authorization: DeepL-Auth-Key ${DEEPL_API_KEY}`、`Content-Type: application/json`
- リクエスト body:

```json
{ "text": ["翻訳したい文字列1", "文字列2"], "source_lang": "JA", "target_lang": "EN-US" }
```

- レスポンス: `{ "translations": [{ "text": "...", "detected_source_language": "JA" }, ...] }`
- **バッチ処理**: `refreshTranslations` では未翻訳テキストを最大50件ずつまとめて1リクエストで送る(`text` は配列可)。`translateText` 単発時は1件で送る。
- エラーハンドリング:
  - `429`(rate limit): 1回だけ 2秒待って再試行。再失敗なら failed 扱い。
  - `456`(quota exceeded / 無料枠超過): 再試行せず failed 扱い。warn ログを1回出す。
  - `403`(キー不正): failed 扱い + error ログ。
- ロケールマッピング: `ja → JA`, `en → EN-US`。それ以外の target_locale が来たら 400。

### 4.4 mock provider 仕様

- `DEEPL_API_KEY` 未設定時の開発用フォールバック。`[en] ${sourceText}` 形式を返す(partner-portals の `mock-cache` と同等。手動辞書 `MOCK_TRANSLATIONS` は移植不要)。

## 5. backend API 変更

### 5.1 既存 API のローカライズ対応

対象: `GET /events`(eventController)と `GET /points/services`(pointController)。

- クエリパラメータ `?locale=en` を受け付ける。`en` 以外は全て `ja` 扱い(バリデーション: `locale === 'en' ? 'en' : 'ja'`)。
- `locale=en` のとき、レスポンスの以下のフィールドを `localizeRows` で翻訳済みテキストに差し替える:

| API | contentType | idField | fields |
|---|---|---|---|
| GET /events | `event` | `event_id` | `event_name`, `location` |
| GET /points/services | `service` | `service_id` | `service_name` |
| GET /points/services | `store` | `store_id` | `store_name` |

- 元のフィールド名のまま翻訳文を返す(フィールド追加はしない)。フロントの型変更を不要にするため。
- キャッシュヒット時のオーバーヘッドは SELECT 1回で済むよう、一覧系は `WHERE (content_type, ...) IN (...)` 相当の一括取得で実装する(1行ずつ N+1 クエリにしない)。

### 5.2 翻訳エンドポイント(新規)

ルート: `backend/routes/translationRoutes.js` を新規作成し `app.js` に `/api/translations` でマウント。

**POST /api/translations/translate** — partner-portals 向け内部API。

- 認証: ヘッダ `x-refresh-key` が `TRANSLATION_REFRESH_KEY` と一致すること(未設定時は開発用に素通し)。
- リクエスト/レスポンスは partner-portals の `translateWithConfiguredApi()` が送る形式に**そのまま合わせる**:

```json
// request
{ "source_locale": "ja", "target_locale": "en", "text": "...", "content_type": "event", "content_id": "1", "field_name": "event_name" }
// response 200
{ "translated_text": "...", "provider": "deepl" }
```

**POST /api/translations/refresh** — 全件事前翻訳。

- 認証: 同上(`x-refresh-key`)。
- クエリ `?force=1` で hash 一致でも強制再翻訳。
- レスポンス: `{ "records": n, "translated": n, "skipped": n, "failed": n }`
- refresh 対象は 5.1 の表と同じ(events / services / stores の対象フィールド全件)。

### 5.3 partner-portals の接続設定(コード変更なし)

partner-portals の `.env` に以下を設定するだけで backend のキャッシュを共有する:

```
TRANSLATION_API_URL=http://localhost:3000/api/translations/translate
TRANSLATION_API_TOKEN=          # 使わない(backend は x-refresh-key 方式)
TRANSLATION_PROVIDER=deepl
```

- 注意: partner-portals の既存実装は `Authorization: Bearer` を送るが、backend 側は `x-refresh-key` を見る。`TRANSLATION_REFRESH_KEY` を設定する運用にする場合のみ、partner-portals の `translateWithConfiguredApi()` に `x-refresh-key` ヘッダ送信を1行追加する(唯一の partner-portals 側変更。任意)。
- partner-portals 自身の JSON ファイルキャッシュは現状のまま残す(二重キャッシュになるが害はなく、削除は今回のスコープ外)。

## 6. frontend 変更

`frontend/src/App.tsx`:

1. `GET /events`、`GET /points/services` の fetch に `?locale=${language}` を付与する。言語切替時は再フェッチする(既存の言語 state 変更ハンドラにフェッチ処理を追加)。
2. `localizeApiText()` と `localizedContent` 辞書は**フォールバックとして残す**(API が原文を返した場合のみ作用するため無害)。新規エントリの追加はしない。
3. 型 `ServiceItem` 等の変更は不要(5.1 でフィールド名を変えないため)。

## 7. 実装しないこと(スコープ外)

- ja/en 以外の言語対応(設計上 `target_locale` で拡張可能にしておくだけ)
- UI固定文言(`translations` オブジェクト)の DeepL 化 — 現行の手動管理のまま
- partner-portals の JSON キャッシュ廃止
- 管理画面からの翻訳編集機能
- マップ機能関連(別仕様)

## 8. テスト要件

1. **ユニット**: `translationService` — キャッシュヒット時に fetch が呼ばれないこと / 原文変更(hash 不一致)で再翻訳されること / DeepL 失敗時に原文フォールバックすること(fetch をモック)。
2. **スモーク**: `backend/scripts/smokeTest.js` に追加 — mock provider で `GET /points/services?locale=en` が `[en] ` プレフィックス付きテキストを返すこと、`locale` なしで原文が返ること。
3. **手動確認手順**(README または本ファイル末尾に記載): `DEEPL_API_KEY` 設定 → `POST /api/translations/refresh` → `content_translations` テーブルに `provider='deepl'` の行が入ること → 2回目の refresh で `skipped` が全件になること(文字数を消費しないことの確認)。

## 9. 実装順序(推奨)

1. env 追加 + `content_translations` テーブル(schema.sql / sqlite.js)
2. `translationService.js`(mock provider で動くところまで)+ ユニットテスト
3. DeepL provider 実装
4. `GET /events` / `GET /points/services` の locale 対応
5. `/api/translations/translate` + `/refresh` エンドポイント
6. frontend の locale パラメータ付与
7. partner-portals の env 切替 + スモークテスト
