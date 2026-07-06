# Link Town Backend API

2026-05-30 時点の backend 実装に基づく API 一覧です。  
ローカル開発の Base URL は `http://localhost:3000` です。

## 共通

- 認証が必要な API は `Authorization: Bearer <JWT>` を付与します。
- 一般ユーザー JWT は `role: "user"`、管理者 JWT は `role: "admin"` を持ちます。
- 管理者 API は `/admin/*` 配下で、管理者 token のみ成功します。

## Health

| Method | Path | Auth | 概要 |
| --- | --- | --- | --- |
| GET | `/` | 不要 | API 稼働確認 |

## Auth

| Method | Path | Auth | 概要 |
| --- | --- | --- | --- |
| POST | `/auth/register` | 不要 | 一般ユーザー登録 |
| POST | `/auth/login` | 不要 | 一般ユーザーログイン |
| POST | `/auth/admin/login` | 不要 | 管理者ログイン |
| POST | `/auth/email/verify` | 不要 | 登録確認メール token によるメール認証完了 |
| POST | `/auth/email/resend` | 不要 | 未認証ユーザーへの登録確認メール token 再発行 |
| POST | `/auth/password/reset-request` | 不要 | パスワード再発行 token 発行。開発時は response に `reset_token` を含む |
| POST | `/auth/password/reset` | 不要 | reset token によるパスワード再設定 |
| PUT | `/auth/password` | user | 現在パスワード確認付きのパスワード変更 |

登録確認メールは既定で `MAIL_DRIVER=smtp` として実SMTP配送します。`SMTP_HOST`、`SMTP_FROM`、必要に応じて `SMTP_USER` / `SMTP_PASSWORD` を設定してください。  
自動テストや明示的なローカル確認のみ `MAIL_DRIVER=outbox` と `MAIL_EXPOSE_VERIFICATION_TOKEN=true` を使用できます。

## Users

| Method | Path | Auth | 概要 |
| --- | --- | --- | --- |
| GET | `/users/:id/points` | user/admin | ユーザー基本情報とポイント取得 |
| GET | `/users/:id/history` | user/admin | 参加履歴、ポイント取引履歴、購入履歴取得 |
| GET | `/users/:id/purchases` | user/admin | ポイント購入履歴取得 |
| GET | `/users/:id/liked-events` | user/admin | いいね済みイベント取得 |
| GET | `/users/:id/favorite-services` | user/admin | お気に入り交換サービス取得 |
| PUT | `/users/:id/email` | user/admin | メールアドレス変更 |
| DELETE | `/users/:id` | user/admin | アカウント削除 |
| GET | `/users/:id/settings` | user/admin | ユーザー設定取得 |
| PUT | `/users/:id/settings` | user/admin | 通知、言語、文字サイズ設定更新 |
| GET | `/users/:id/payment-methods` | user/admin | mock 支払方法一覧取得 |
| POST | `/users/:id/payment-methods` | user/admin | mock 支払方法追加 |
| DELETE | `/users/:id/payment-methods/:paymentMethodId` | user/admin | mock 支払方法削除 |
| GET | `/users/:id/notifications` | user/admin | 通知一覧取得 |

一般ユーザーは自分の `:id` のみ操作できます。管理者は任意ユーザーを参照、更新できます。

## Events

| Method | Path | Auth | 概要 |
| --- | --- | --- | --- |
| GET | `/events` | user | 公開中イベント一覧取得。`liked`, `like_count` を含む。`?locale=en` で `event_name`, `location` を翻訳キャッシュ経由で返す |
| POST | `/events/participate` | user | `event_id` 指定のイベント参加登録とポイント付与 |
| DELETE | `/events/:id/participation` | user | 指定イベントの参加応募キャンセル、付与ポイントの取り消し |
| POST | `/events/check-in` | user | `check_in_code` による QR チェックイン参加 |
| POST | `/events/:id/like` | user | イベントいいね追加 |
| DELETE | `/events/:id/like` | user | イベントいいね解除 |

## Points

| Method | Path | Auth | 概要 |
| --- | --- | --- | --- |
| GET | `/points/services` | user | 公開中の交換サービス一覧取得。`favorited` を含む。`?locale=en` で `service_name`, `store_name` を翻訳キャッシュ経由で返す |
| POST | `/points/exchange` | user | ポイント交換 |
| POST | `/points/purchase` | user | mock ポイント購入。`paid` の場合のみ残高加算 |
| POST | `/points/services/:id/favorite` | user | 交換サービスお気に入り追加 |
| DELETE | `/points/services/:id/favorite` | user | 交換サービスお気に入り解除 |

## Notifications

| Method | Path | Auth | 概要 |
| --- | --- | --- | --- |
| PUT | `/notifications/:id/read` | user/admin | 通知を既読化 |

## Support

| Method | Path | Auth | 概要 |
| --- | --- | --- | --- |
| GET | `/support/tickets` | user | 自分の問い合わせ、不具合報告一覧取得 |
| POST | `/support/tickets` | user/admin | 問い合わせ、不具合報告作成 |

## Translations

| Method | Path | Auth | 概要 |
| --- | --- | --- | --- |
| POST | `/api/translations/translate` | refresh key | partner-portals 向けの単文翻訳。`TRANSLATION_REFRESH_KEY` 未設定時は開発用にキーなしで通す |
| POST | `/api/translations/refresh` | refresh key | events/services/stores の対象フィールドを事前翻訳。`?force=1` で強制更新 |

## Admin

| Method | Path | Auth | 概要 |
| --- | --- | --- | --- |
| GET | `/admin/stats` | admin | 集計取得。参加、付与、交換、購入、未解決 ticket、イベント別、サービス別を含む |
| GET | `/admin/events` | admin | イベント一覧取得。QR check-in code を含む |
| POST | `/admin/events` | admin | イベント作成。check-in code も発行 |
| GET | `/admin/events/:id/check-in-code` | admin | イベント check-in code 取得、未発行なら発行 |
| PUT | `/admin/events/:id` | admin | イベント更新、公開停止/再公開 |
| DELETE | `/admin/events/:id` | admin | イベント削除 |
| GET | `/admin/stores` | admin | 店舗一覧取得 |
| POST | `/admin/stores` | admin | 店舗作成 |
| PUT | `/admin/stores/:id` | admin | 店舗更新、公開停止/再公開 |
| DELETE | `/admin/stores/:id` | admin | 店舗削除 |
| GET | `/admin/services` | admin | 交換サービス一覧取得 |
| POST | `/admin/services` | admin | 交換サービス作成 |
| PUT | `/admin/services/:id` | admin | 交換サービス更新、公開停止/再公開 |
| DELETE | `/admin/services/:id` | admin | 交換サービス削除 |
| GET | `/admin/users` | admin | ユーザー一覧、`search` query による名前/メール検索 |
| GET | `/admin/users/:id` | admin | ユーザー詳細、参加/取引/購入履歴取得 |
| PUT | `/admin/users/:id` | admin | ユーザー情報、ポイント更新 |
| POST | `/admin/notifications` | admin | 全体または指定ユーザーへ通知配信 |
| GET | `/admin/support/tickets` | admin | 問い合わせ一覧取得 |
| PUT | `/admin/support/tickets/:id` | admin | 問い合わせ status/admin note 更新 |

## ローカル検証

```powershell
npm run db:reset
npm run test
npm run db:report
```

`npm run test` は backend smoke test と frontend build を実行します。
