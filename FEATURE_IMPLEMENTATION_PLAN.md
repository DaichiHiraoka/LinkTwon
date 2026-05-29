# FEATURE_IMPLEMENTATION_PLAN

> 2026-05-30 実装メモ: この計画を元にした実装結果と例外事項は `IMPLEMENTATION_NOTES.md`、現在の UI/API で可能なことは `BASE_SPEC.md`、backend API 一覧は `backend/BASE_API.md` に反映済みです。

現時点の `codex/provisional-snapshot` 状態を前提に、未実装機能をすべて実装するための計画です。  
現在の frontend は追加 UI 設計図が来るまでの仮実装です。正式 UI への差し替えを前提に、機能単位の責務と API 契約を先に固めます。

## 現在実装済み

- 一般ユーザー登録
- 一般ユーザーログイン
- JWT のローカル保持
- ログアウト
- ポイント残高取得
- イベント一覧取得
- イベント参加登録
- ポイント交換サービス一覧取得
- ポイント交換
- 参加履歴、ポイント取引履歴取得
- SQLite によるローカル DB 検証
- `ngrok-free.app` 経由の Vite host 許可
- 管理者向け backend API の一部
  - イベント一覧、作成、更新
  - 店舗一覧、作成、更新
  - サービス一覧、作成
  - 統計取得

## 全体方針

- 追加 UI 設計図が届くまでは、frontend は機能確認用の仮 UI として維持する。
- backend にない概念を frontend だけで本実装扱いにしない。
- 画面文言、導線、レイアウトは正式 UI 設計図に合わせて後続で差し替える。
- DB に影響する機能は、必ず `UI -> API -> DB -> db:report` または e2e テストで確認する。
- 管理者系と一般ユーザー系は画面、状態、API クライアントを分ける。

## Phase 1: 現行 backend で完了できる frontend 機能

### 1. セッション管理の整理

目的: 現在の仮実装を正式 UI 差し替えに耐える状態へ分離する。

実装内容

- `session` 管理を `App.tsx` から専用 hook または context に分離する。
- JWT 期限切れ時にログイン画面へ戻す。
- API 401 / 403 / 500 の表示方針を統一する。
- ローカル保存キーを定数化済みのまま維持し、将来の storage 変更に備える。

受け入れ条件

- ログイン後にリロードしてもログイン状態が復元される。
- 期限切れまたは不正 token ではログイン画面へ戻る。
- API エラーが画面上で確認できる。

### 2. 一般ユーザー画面の機能整理

目的: 既存 backend API で成立するユーザー体験を正式 UI 差し替え前に固める。

実装内容

- ホームにポイント残高、直近参加、直近取引を表示する。
- イベント一覧で参加済み状態を判定する。
- 参加済みイベントの重複参加を UI 側で抑止する。
- ポイント交換一覧で現在ポイント不足のものを判定する。
- 交換履歴を時系列で表示する。
- 参加履歴を時系列で表示する。
- 再取得操作を正式 UI コンポーネントへ移せる形にする。

受け入れ条件

- イベント参加後、ポイント残高と履歴が更新される。
- ポイント交換後、ポイント残高と履歴が更新される。
- 参加済みイベントは再参加操作できない。
- ポイント不足サービスは交換操作できない。

### 3. 管理者 frontend の追加

目的: 既存 backend の管理者 API を UI から操作できる状態にする。

実装内容

- 管理者ログイン画面を追加する。
- 管理者 session を一般ユーザー session と分ける。
- 管理者ダッシュボードを追加する。
- イベント一覧、作成、更新画面を追加する。
- 店舗一覧、作成、更新画面を追加する。
- サービス一覧、作成画面を追加する。
- 統計カードを追加する。

受け入れ条件

- `admin` / `admin123` の seed 管理者でログインできる。
- 管理者画面からイベントを作成し、一般ユーザーのイベント一覧に反映される。
- 店舗を作成し、その店舗に紐づく交換サービスを作成できる。
- 統計値が参加、付与ポイント、交換数に連動して変化する。

## Phase 2: backend 追加が必要なユーザー機能

### 4. ポイント購入

目的: 現在仮表示のポイント購入を実データ化する。

backend 実装

- `point_purchases` テーブルを追加する。
- `POST /points/purchase` を追加する。
- `GET /users/:id/purchases` を追加する。
- 決済状態を `pending`, `paid`, `failed`, `cancelled` で管理する。
- 開発用は mock 決済で即時 `paid` にできるようにする。

frontend 実装

- 購入ポイント選択 UI を追加する。
- 支払方法選択 UI を追加する。
- 購入確認、完了、失敗状態を追加する。
- 購入後にポイント残高を再取得する。

受け入れ条件

- 購入操作で `users.points` が増える。
- 購入履歴を確認できる。
- 失敗時にポイントが増えない。

### 5. イベントいいね

目的: UI 設計に存在する「いいねしたイベント」を実データ化する。

backend 実装

- `event_likes` テーブルを追加する。
- `POST /events/:id/like` を追加する。
- `DELETE /events/:id/like` を追加する。
- `GET /users/:id/liked-events` を追加する。
- `GET /events` に `liked` または `like_count` を返すか検討する。

frontend 実装

- イベントカードにいいね操作を追加する。
- いいね済み一覧タブを backend データに接続する。
- いいね状態を楽観更新または再取得で反映する。

受け入れ条件

- いいねを付け外しできる。
- いいねしたイベント一覧が再ログイン後も保持される。
- 自分のいいね状態がイベント一覧に反映される。

### 6. 交換サービスお気に入り

目的: UI 設計に存在する「お気に入り」を実データ化する。

backend 実装

- `service_favorites` テーブルを追加する。
- `POST /points/services/:id/favorite` を追加する。
- `DELETE /points/services/:id/favorite` を追加する。
- `GET /users/:id/favorite-services` を追加する。
- `GET /points/services` に `favorited` を返すか検討する。

frontend 実装

- サービスカードにお気に入り操作を追加する。
- お気に入りタブを backend データに接続する。
- 交換履歴とは別の概念として表示する。

受け入れ条件

- お気に入りを付け外しできる。
- お気に入りサービス一覧が再ログイン後も保持される。
- 交換履歴とお気に入りが混同されない。

### 7. QR 読み取り参加

目的: 現在仮表示の QR 画面をイベント参加処理へ接続する。

backend 実装

- イベントごとの QR token または check-in code を発行する。
- `POST /events/check-in` を追加する。
- QR token の有効期限、対象イベント、重複参加を検証する。
- 必要なら `event_checkin_tokens` テーブルを追加する。

frontend 実装

- カメラ起動と QR 読み取りを追加する。
- 読み取り結果を `POST /events/check-in` に送信する。
- 成功、重複、期限切れ、不正 QR の状態を表示する。

受け入れ条件

- 有効 QR でイベント参加とポイント付与が完了する。
- 同一イベントの重複読み取りではポイントが重複付与されない。
- 無効 QR では DB が更新されない。

## Phase 3: アカウント、設定、通知

### 8. パスワード再発行

backend 実装

- `password_reset_tokens` テーブルを追加する。
- `POST /auth/password/reset-request` を追加する。
- `POST /auth/password/reset` を追加する。
- 開発用はメール送信の代わりに reset token をログ出力または DB 確認できるようにする。

frontend 実装

- パスワードを忘れた場合の画面を追加する。
- reset token 入力画面を追加する。
- 新パスワード設定画面を追加する。

### 9. パスワード変更

backend 実装

- `PUT /auth/password` を追加する。
- 現在パスワード確認を必須にする。

frontend 実装

- アカウント画面にパスワード変更フォームを追加する。
- 成功後に再ログインを求めるか、session 継続するか仕様決定する。

### 10. メールアドレス変更

backend 実装

- `PUT /users/:id/email` を追加する。
- メール重複チェックを行う。
- 本番では確認メールフローを追加する。

frontend 実装

- アカウント画面にメール変更フォームを追加する。
- 変更後の session 表示を更新する。

### 11. アカウント削除

backend 実装

- `DELETE /users/:id` を追加する。
- 物理削除か論理削除かを決める。
- 履歴保持方針を決める。

frontend 実装

- 削除確認画面を追加する。
- 削除後は session を破棄する。

### 12. ユーザー設定

backend 実装

- `user_settings` テーブルを追加する。
- `GET /users/:id/settings` を追加する。
- `PUT /users/:id/settings` を追加する。
- 通知、言語、文字サイズを保存する。

frontend 実装

- 通知設定、言語設定、文字サイズ設定画面を追加する。
- 文字サイズは local CSS に即時反映する。

## Phase 4: 支払方法、通知、お知らせ、問い合わせ

### 13. 支払方法管理

backend 実装

- `payment_methods` テーブルを追加する。
- `GET /users/:id/payment-methods` を追加する。
- `POST /users/:id/payment-methods` を追加する。
- `DELETE /users/:id/payment-methods/:paymentMethodId` を追加する。
- 本番決済連携の前は mock payment method として実装する。

frontend 実装

- 支払方法一覧、追加、削除 UI を追加する。
- ポイント購入画面から支払方法を選択できるようにする。

### 14. 通知、お知らせ

backend 実装

- `notifications` テーブルを追加する。
- `GET /users/:id/notifications` を追加する。
- `PUT /notifications/:id/read` を追加する。
- 管理者からのお知らせ配信 API を追加する。

frontend 実装

- メールアイコンから通知一覧を開く。
- 未読件数を表示する。
- 既読化操作を追加する。

### 15. お問い合わせ、不具合報告

backend 実装

- `support_tickets` テーブルを追加する。
- `POST /support/tickets` を追加する。
- `GET /admin/support/tickets` を追加する。
- `PUT /admin/support/tickets/:id` を追加する。

frontend 実装

- お問い合わせフォームを追加する。
- 不具合報告フォームを追加する。
- 送信履歴を確認できるようにするか判断する。

## Phase 5: 管理者機能の拡張

### 16. 管理者による削除、公開管理

backend 実装

- `DELETE /admin/events/:id` を追加する。
- `DELETE /admin/stores/:id` を追加する。
- `DELETE /admin/services/:id` を追加する。
- `is_active` または `status` カラムを追加し、公開停止を表現する。

frontend 実装

- 一覧で公開中、停止中を切り替える。
- 削除前の確認を追加する。

### 17. 管理者ユーザー管理

backend 実装

- `GET /admin/users` を追加する。
- `GET /admin/users/:id` を追加する。
- `PUT /admin/users/:id` を追加する。
- ユーザーのポイント調整 API を追加するか検討する。

frontend 実装

- ユーザー一覧、検索、詳細画面を追加する。
- ユーザーごとの参加履歴、取引履歴を表示する。

### 18. 統計の詳細化

backend 実装

- 期間指定を追加する。
- イベント別参加数を追加する。
- サービス別交換数を追加する。
- 日別ポイント付与、消費推移を追加する。

frontend 実装

- 管理者ダッシュボードに期間 filter を追加する。
- グラフまたは表で集計を表示する。

## Phase 6: 正式 UI 差し替え

### 19. UI 設計図反映

実装内容

- 追加 UI 設計図を画面単位で分解する。
- 現在の仮 UI class を正式 UI class に差し替える。
- 画面遷移、タブ、モーダル、フォームの仕様を設計図に合わせる。
- 仮実装を示す `TEMP BUILD` 表示、破線、注記を削除する。
- 未対応機能が残る場合は正式な disabled / coming soon 表現に置き換える。

受け入れ条件

- 追加 UI 設計図と主要画面の構造が一致する。
- 仮実装であることを示す視覚要素が残っていない。
- 既存の API 連携機能が UI 差し替え後も動作する。

### 20. アクセシビリティと入力品質

実装内容

- フォーム label と error message を整理する。
- keyboard 操作で主要導線を完結できるようにする。
- loading、empty、error、success の各状態を全画面に用意する。
- 入力値 validation を frontend と backend の両方で揃える。

受け入れ条件

- 主要フォームで未入力、重複、形式不正の表示ができる。
- keyboard だけでログイン、イベント参加、交換、ログアウトができる。

## Phase 7: テスト、品質、運用

### 21. API テスト

実装内容

- auth、events、points、users、admin の API テストを追加する。
- SQLite test DB を毎回 reset する。
- 正常系、認証エラー、権限エラー、重複、ポイント不足を確認する。

受け入れ条件

- CI または `npm test` で主要 API が検証できる。
- DB 更新を伴う API の rollback が確認できる。

### 22. frontend テスト

実装内容

- React component test を追加する。
- API mock を使った画面状態テストを追加する。
- Playwright で UI 操作から DB 更新までの e2e を追加する。

受け入れ条件

- ログイン、参加、交換、履歴確認の e2e が通る。
- 主要画面の error / empty / loading が確認できる。

### 23. セキュリティ強化

実装内容

- JWT secret を `.env` 必須にする。
- password policy を追加する。
- rate limit を追加する。
- CORS と Vite allowed hosts の運用ルールを分ける。
- 本番では SQLite ではなく MySQL または managed DB を使う。
- seed password を本番に混入させない。

受け入れ条件

- 開発用 seed と本番設定が分離される。
- ログイン API に rate limit がかかる。
- `.env.example` に必要環境変数が揃っている。

### 24. デプロイ準備

実装内容

- production build 手順を整理する。
- backend の起動コマンドと frontend の配信方法を決める。
- DB migration 手順を追加する。
- ログ出力、エラー監視、バックアップ方針を決める。

受け入れ条件

- 新規環境で README 手順だけで起動できる。
- DB schema 更新を migration として再現できる。

## 推奨実装順

1. 管理者 frontend の追加
2. 一般ユーザー画面の状態整理
3. イベントいいね
4. 交換サービスお気に入り
5. QR 読み取り参加
6. ポイント購入
7. アカウント設定、パスワード変更、メール変更
8. 支払方法、通知、お問い合わせ
9. 管理者機能拡張
10. 正式 UI 設計図の反映
11. テスト、セキュリティ、デプロイ整備

## 優先判断

- 追加 UI 設計図がすぐ来る場合は、先に backend API と state 管理を固め、見た目の作り込みは保留する。
- 先にデモが必要な場合は、管理者 frontend と QR 読み取り参加を優先する。
- DB 更新の信頼性を重視する場合は、API テストと e2e を Phase 2 の前に入れる。
