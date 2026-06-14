# D1 基本設計書 8章更新案: プロトコルとインターフェース

対象: `D1_基本設計書_最終版_20260419.pdf` の「8. プロトコルとインターフェース」

更新日: 2026-06-14

## 8. プロトコルとインターフェース

### 8.1 通信プロトコル

本システムは、利用者向けWebアプリ、イベント主催者向けアプリ、商店向けアプリ、管理者向けAPIを分離し、HTTPS上のJSON APIで連携する。

| 区分 | 理想形 |
| --- | --- |
| 通信 | 外部公開される通信はHTTPS/TLSを必須とし、平文通信を禁止する。 |
| API形式 | RESTful APIを基本とし、リクエスト/レスポンスはJSONで統一する。 |
| 文字コード | UTF-8を標準とする。 |
| 認証 | JWT Bearer認証を採用する。ログイン成功時にJWTを発行し、以降は`Authorization: Bearer <token>`で送信する。 |
| Origin制御 | 許可されたクライアントOriginからの通信のみ受け付ける。 |
| DB接続 | サーバは永続化層としてSQLデータベースへ接続し、トランザクション整合性を担保する。 |
| 接続先管理 | クライアントは環境ごとのAPIベースURLを参照し、通信先を画面実装から分離する。 |

### 8.2 アプリケーション境界

| アプリ | 役割 | 配置方針 |
| --- | --- | --- |
| 利用者Webアプリ | ログイン、イベント閲覧、参加登録、本人確認QR表示、ポイント確認、商品交換、店舗地図表示、設定変更 | 利用者向けクライアントとして提供する。 |
| サーバAPI | 認証、ユーザー、イベント、ポイント、通知、サポート、管理者APIを提供 | すべてのクライアントから利用されるサーバAPIとして提供する。 |
| イベント主催者アプリ | 主催者が利用者の本人確認QRを読み取り、イベント受付を確定する | イベント運営者向けの専用クライアントとして提供する。 |
| 商店アプリ | 商店が利用者の本人確認QRを読み取り、ポイント交換を確定する | 加盟店向けの専用クライアントとして提供する。 |
| 翻訳キャッシュ | 商品・イベントなど可変コンテンツを定期翻訳し、表示時はキャッシュを参照する | 可変コンテンツの表示補助機能としてサーバ側で管理する。 |

### 8.3 認証・認可インターフェース

| Endpoint | Method | Auth | 概要 |
| --- | --- | --- | --- |
| `/auth/register` | POST | 不要 | 利用者アカウント登録 |
| `/auth/login` | POST | 不要 | 利用者ログイン、JWT発行 |
| `/auth/admin/login` | POST | 不要 | 管理者ログイン、管理者JWT発行 |
| `/auth/password/reset-request` | POST | 不要 | パスワード再設定トークン発行 |
| `/auth/password/reset` | POST | 不要 | 再設定トークンによるパスワード更新 |
| `/auth/password` | PUT | user/admin | 現在パスワード確認付きパスワード変更 |

JWTには利用者種別・権限を含め、一般利用者APIと管理者APIを分離する。管理者APIは`/admin/*`配下に集約し、管理者ロールのみ許可する。

### 8.4 利用者向けAPIインターフェース

| Endpoint | Method | Auth | 概要 |
| --- | --- | --- | --- |
| `/users/:id/points` | GET | user/admin | ユーザー情報と保有ポイント取得 |
| `/users/:id/history` | GET | user/admin | 参加履歴・ポイント取引履歴・購入履歴取得 |
| `/users/:id/purchases` | GET | user/admin | ポイント購入履歴取得 |
| `/users/:id/liked-events` | GET | user/admin | いいね済みイベント取得 |
| `/users/:id/favorite-services` | GET | user/admin | お気に入りサービス取得 |
| `/users/:id/settings` | GET/PUT | user/admin | 通知・言語・文字サイズ設定取得/更新 |
| `/users/:id/email` | PUT | user/admin | メールアドレス変更 |
| `/users/:id/payment-methods` | GET/POST | user/admin | 支払い方法一覧取得/追加 |
| `/users/:id/payment-methods/:paymentMethodId` | DELETE | user/admin | 支払い方法削除 |
| `/users/:id/notifications` | GET | user/admin | 通知一覧取得 |
| `/notifications/:id/read` | PUT | user/admin | 通知既読化 |
| `/support/tickets` | GET/POST | user/admin | 問い合わせ/不具合チケット取得・作成 |

一般利用者は原則として自分自身の`user_id`のみ操作できる。管理者は運用上必要な範囲で他ユーザーを参照・更新できる。

### 8.5 イベント・ポイントAPIインターフェース

| Endpoint | Method | Auth | 概要 |
| --- | --- | --- | --- |
| `/events` | GET | user | 公開中イベント一覧取得 |
| `/events/participate` | POST | user | イベント参加登録・ポイント付与 |
| `/events/:id/participation` | DELETE | user | 参加キャンセル・付与ポイント取り消し |
| `/events/check-in` | POST | user | チェックインコードによる参加登録 |
| `/events/:id/like` | POST/DELETE | user | イベントいいね追加/解除 |
| `/points/services` | GET | user | 交換可能サービス一覧取得 |
| `/points/exchange` | POST | user | ポイント交換 |
| `/points/purchase` | POST | user | ポイント購入 |
| `/points/services/:id/favorite` | POST/DELETE | user | サービスお気に入り追加/解除 |

利用者アプリ内では、商品選択時に店舗名・住所から地図検索URLを生成し、地図表示と外部地図画面への遷移を提供する。店舗正式名称、住所、地図検索クエリは翻訳せず原文値を保持する。

### 8.6 管理者APIインターフェース

| Endpoint | Method | Auth | 概要 |
| --- | --- | --- | --- |
| `/admin/stats` | GET | admin | 参加・ポイント付与・交換・購入等の集計取得 |
| `/admin/events` | GET/POST | admin | イベント一覧取得・作成 |
| `/admin/events/:id` | PUT/DELETE | admin | イベント更新・削除 |
| `/admin/events/:id/check-in-code` | GET | admin | イベントチェックインコード取得/再発行 |
| `/admin/stores` | GET/POST | admin | 店舗一覧取得・作成 |
| `/admin/stores/:id` | PUT/DELETE | admin | 店舗更新・削除 |
| `/admin/services` | GET/POST | admin | サービス一覧取得・作成 |
| `/admin/services/:id` | PUT/DELETE | admin | サービス更新・削除 |
| `/admin/users` | GET | admin | ユーザー一覧取得、検索 |
| `/admin/users/:id` | GET/PUT | admin | ユーザー詳細取得・更新 |
| `/admin/notifications` | POST | admin | 通知配信 |
| `/admin/support/tickets` | GET | admin | 問い合わせ/不具合チケット一覧取得 |
| `/admin/support/tickets/:id` | PUT | admin | チケット状態・管理メモ更新 |

### 8.7 本人確認QRプロトコル

現行仕様では、利用者が自分のアプリに本人確認QRを表示し、イベント主催者または商店がそれを読み取る。PayPay等の利用者提示型に近い方式とし、主催者・商店がQRを発行して利用者が読む方式は採用しない。

QRペイロードは次のURI形式を標準とする。

```text
linktown://user-present?v=1&type=user-present&user_id=<user_id>&name=<display_name>&issued_at=<ISO8601>&expires_at=<ISO8601>&nonce=<uuid>
```

| 項目 | 内容 |
| --- | --- |
| `v` | QR仕様バージョン。初期値は`1`。 |
| `type` | `user-present`固定。 |
| `user_id` | 利用者ID。 |
| `name` | 表示名。本人確認補助に利用する。 |
| `issued_at` | 発行時刻。 |
| `expires_at` | 有効期限。現行UIでは発行から5分。 |
| `nonce` | 再利用・重複処理防止用の一意値。 |

QRにはJWT、パスワード、決済情報などの秘密情報を含めない。読み取り側は期限切れ、形式不正、必須項目不足、同一nonceの重複利用を拒否する。

| 読み取り側 | Endpoint | Method | 概要 |
| --- | --- | --- | --- |
| イベント主催者アプリ | `/api/event/check-ins` | POST | 利用者QRを読み取り、対象イベントの受付を確定する。 |
| 商店アプリ | `/api/store/exchanges` | POST | 利用者QRを読み取り、対象サービスの交換を確定する。 |
| 主催者/商店共通 | `/api/bootstrap` | GET | アクセスコードに基づく初期データ取得。 |
| 主催者/商店共通 | `/api/translations/refresh` | POST | 翻訳キャッシュ手動更新。`PARTNER_REFRESH_KEY`設定時は`x-refresh-key`必須。 |

### 8.8 翻訳インターフェース

固定UI文言はアプリ内翻訳辞書で即時切り替えする。イベント名、商品名、商品説明など運営者・商店が入力する可変コンテンツは、表示のたびに翻訳APIを呼ばず、定期翻訳・更新時翻訳・キャッシュ参照を基本とする。

翻訳APIの要求形式は次を標準とする。

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

応答は`translated_text`または`translation`を受け取る。翻訳キャッシュは`source_locale`、`target_locale`、`source_text_hash`、`translated_text`、`translated_at`、`translation_provider`、`translation_status`を保持する。翻訳未生成・失敗・古い場合は原文表示へフォールバックする。

### 8.9 外部連携インターフェース

| 外部連携 | 用途 | 接続方針 |
| --- | --- | --- |
| 地図サービス | 店舗位置表示 | 店舗名・住所から地図検索URLを生成する。住所・店舗名は原文を使用する。 |
| 翻訳サービス | 可変コンテンツ翻訳 | 翻訳対象テキスト、対象言語、コンテンツ種別、項目名を送信し、翻訳結果をキャッシュする。 |
| メール/通知基盤 | 通知・サポート連絡 | 必要に応じてユーザー通知、パスワード再設定、問い合わせ連絡に利用する。 |
| 決済/購入基盤 | ポイント購入 | ポイント購入時に支払い方法と購入結果を連携する。初期段階ではモック処理も許容する。 |

### 8.10 エラーハンドリング

| 状態 | HTTP Status | UI表示 |
| --- | --- | --- |
| 正常 | 200/201 | 成功状態、反映結果、最新データを表示 |
| 入力不正 | 400 | フォーム項目またはモーダル内に理由を表示 |
| 認証失敗 | 401 | セッションを破棄しログイン画面へ戻す |
| 権限不足 | 403 | 操作不可メッセージを表示 |
| 対象なし | 404 | 対象が存在しない旨を表示 |
| 重複/競合 | 409 | 既に受付済み、交換済み、参加済み等を表示 |
| レート制限 | 429 | 時間を置いて再試行する案内を表示 |
| サーバ障害 | 500 | 汎用エラーを表示し、詳細はサーバログへ記録 |
| ネットワーク失敗 | fetch error | 通信先不達、Origin不許可、一時的なサーバ停止の可能性を案内する。ログイン時は短時間リトライする。 |

### 8.11 セキュリティ対策

- 本番環境ではHTTPSを必須とし、平文通信を禁止する。
- JWTはAuthorizationヘッダで送信し、QRコードには含めない。
- Origin制御は許可されたクライアントのみ通す。
- パスワードはハッシュ化して保存する。
- 参加・交換処理はDB上で重複登録を拒否し、二重付与・二重交換を防止する。
- ポイント不足時の交換要求は拒否し、ポイント残高と取引履歴の整合性を保証する。
- 入力値バリデーション、認証、ロール認可はサーバ側で必ず実施する。
- DB接続情報、JWT秘密鍵、翻訳APIトークンなどの秘密情報は、設計書・ソースコード・公開資料に記載しない。
