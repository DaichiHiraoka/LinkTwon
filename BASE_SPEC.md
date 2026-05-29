# BASE_SPEC

現行の `backend/` 実装と、現在の UI 画面案を前提にした整理です。  
ここでいう「可能」は、既存 backend API を使えば UI から実現できることを指します。  
ここでいう「追加実装が必要」は、UI 実装の追加だけでは足りず、画面側または backend 側の追加対応が必要なものを指します。

## 前提

- backend のエンドポイント一覧は [backend/API.md](C:/Users/ok230195/Downloads/地域共生/prototype/LinkTwon/backend/API.md) を基準とする
- 現在の UI 画面案は `login`, `home`, `events`, `scan`, `wallet`, `purchase`, `account`
- backend には一般ユーザー向け API と管理者向け API がある
- 現在の frontend はモック表示中心で、backend 接続は未完了

## 現行 backend 前提で UI から可能なこと

### 一般ユーザー向け

- ログイン
  - `POST /auth/login`
- 新規ユーザー登録
  - `POST /auth/register`
- 自分のポイント残高表示
  - `GET /users/:id/points`
- 自分の基本情報表示
  - `GET /users/:id/points`
  - 取得できる項目は `name`, `email`, `points`, `age_group`, `user_type`
- イベント一覧表示
  - `GET /events`
- イベント参加
  - `POST /events/participate`
- 参加後の最新ポイント残高反映
  - `POST /events/participate` の `current_points`
  - または `GET /users/:id/points`
- ポイント交換対象サービス一覧表示
  - `GET /points/services`
- ポイント交換
  - `POST /points/exchange`
- 交換後の最新ポイント残高反映
  - `POST /points/exchange` の `current_points`
  - または `GET /users/:id/points`
- 自分のイベント参加履歴表示
  - `GET /users/:id/history`
- 自分のポイント取引履歴表示
  - `GET /users/:id/history`

### 管理者向け

- 管理者ログイン
  - `POST /auth/admin/login`
- イベント一覧取得
  - `GET /admin/events`
- イベント作成
  - `POST /admin/events`
- イベント更新
  - `PUT /admin/events/:id`
- 店舗一覧取得
  - `GET /admin/stores`
- 店舗作成
  - `POST /admin/stores`
- 店舗更新
  - `PUT /admin/stores/:id`
- サービス一覧取得
  - `GET /admin/services`
- サービス作成
  - `POST /admin/services`
- 参加数、付与ポイント数、交換数の集計表示
  - `GET /admin/stats`

## 追加実装が必要なこと

### frontend 実装を追加すれば成立するもの

- ログイン状態の保持
  - JWT 保存、復元、ログアウト処理
- API 呼び出しとエラー表示
  - 未認証、権限不足、ポイント不足、重複参加などの表示
- イベント画面からの参加操作
  - 参加ボタン、完了表示、ポイント更新
- ウォレット画面からの交換操作
  - 交換ボタン、完了表示、ポイント更新
- 履歴一覧画面の追加または既存画面への組み込み
  - `participations`
  - `transactions`
- アカウント画面への取得済みユーザー情報の反映
- 管理者用画面の実装
  - ログイン
  - イベント CRUD
  - 店舗 CRUD
  - サービス作成
  - 統計表示

### backend 機能追加が必要なもの

- ポイント購入
  - 現行 backend に購入 API がない
  - 購入履歴、決済、残高加算処理も未実装
- いいねしたイベント
  - 現行 backend にお気に入りやいいねの保存 API がない
- お気に入り商品、よく使う交換先の保存
  - 現行 backend にお気に入り保存 API がない
- QR 読み取り結果を使った参加処理
  - 現行 backend は `event_id` 指定での参加のみ
  - QR トークン検証や会場チェックイン API は未実装
- パスワード再発行
  - 現行 backend にパスワードリセット API がない
- パスワード変更
  - 現行 backend に変更 API がない
- メールアドレス変更
  - 現行 backend に変更 API がない
- アカウント削除
  - 現行 backend に削除 API がない
- 支払方法の管理
  - 現行 backend に支払手段 API がない
- 通知設定
  - 現行 backend に通知設定 API がない
- 言語設定
  - 現行 backend にユーザー設定 API がない
- 文字サイズ設定
  - UI ローカル設定だけで実現は可能だが、端末横断で保持するなら backend API が必要
- セキュリティとプライバシー設定
  - 現行 backend に該当 API がない
- お問い合わせ、不具合報告
  - 現行 backend に問い合わせ受付 API がない
- メール受信箱やお知らせ一覧
  - 現行 backend にメッセージ API がない
- 利用規約、会員規約、プライバシーポリシーの配信管理
  - 静的表示だけなら frontend で可能
  - CMS 的に管理するなら backend または別管理基盤が必要

### 画面設計とのズレとして整理すべきもの

- `イベント` 画面の `いいねしたイベント`
  - backend には対応データがない
  - `参加履歴` に差し替えるか、backend にお気に入り機能を追加するかの判断が必要
- `ウォレット` 画面の `お気に入り`
  - backend には対応データがない
  - `交換履歴` に差し替えるか、お気に入り機能を追加するかの判断が必要
- `ポイント購入` 画面
  - 現状は backend 未対応
  - 仮画面として残すか、導線を止めるか、購入 API を追加するかの判断が必要
- `QR 読み取り完了` 画面
  - 現状は backend と連動しない
  - 実運用するなら QR 読み取り仕様と backend API の追加設計が必要

## 現時点の実装優先候補

- 1. 一般ユーザーログイン
- 2. ホームでのポイント残高表示
- 3. イベント一覧表示
- 4. イベント参加
- 5. 交換サービス一覧表示
- 6. ポイント交換
- 7. 参加履歴、交換履歴表示

この 7 項目は、現行 backend のままで frontend 実装を追加すれば成立します。
