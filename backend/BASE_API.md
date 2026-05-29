# Link Town Backend API

2026/05/26時点での実装済みAPIリスト　これを元に追加実装していきます。

`backend/app.js` と各 controller 実装をもとにした API 一覧です。


## Base URL

- ローカル想定: `http://localhost:3000`

## 認証

- 認証が必要な API は `Authorization: Bearer <JWT>` ヘッダーを使用します。
- JWT には `id` と `role` が入ります。
- 管理者 API は `authenticateToken` に加えて `authorizeRole('admin')` が必要です。

## 共通レスポンス

- すべて JSON を返します。
- 未認証: `401`
  - `Token is required.`
  - `Invalid or expired token.`
- 権限不足: `403`
  - `You do not have permission to access this resource.`
- サーバーエラー: `500`
  - `Internal server error.` または実際のエラーメッセージ

## Health Check

### `GET /`

- 認証: 不要
- 概要: API 稼働確認

Response

```json
{
  "message": "Link Town Backend API is running."
}
```

## Auth

### `POST /auth/register`

- 認証: 不要
- 概要: 一般ユーザー登録

Request body

```json
{
  "name": "Taro",
  "email": "taro@example.com",
  "password": "secret",
  "age_group": "30s",
  "user_type": "general"
}
```

Notes

- 必須: `name`, `email`, `password`
- `email` は一意
- `age_group`, `user_type` は任意
- `user_type` の既定値は `general`

Response `201`

```json
{
  "message": "User registered successfully.",
  "user_id": 1,
  "token": "<jwt>"
}
```

### `POST /auth/login`

- 認証: 不要
- 概要: 一般ユーザーログイン

Request body

```json
{
  "email": "taro@example.com",
  "password": "secret"
}
```

Response `200`

```json
{
  "message": "Login successful.",
  "token": "<jwt>",
  "user": {
    "user_id": 1,
    "name": "Taro",
    "email": "taro@example.com",
    "points": 100,
    "role": "user"
  }
}
```

### `POST /auth/admin/login`

- 認証: 不要
- 概要: 管理者ログイン

Request body

```json
{
  "admin_id": "admin",
  "password": "admin123"
}
```

Response `200`

```json
{
  "message": "Admin login successful.",
  "token": "<jwt>",
  "admin": {
    "admin_id": "admin",
    "role": "admin"
  }
}
```

## Users

### `GET /users/:id/points`

- 認証: ユーザーまたは管理者
- 概要: ユーザーのポイント情報取得

Rules

- 一般ユーザーは自分自身の `:id` のみ取得可
- 管理者は任意ユーザーを取得可

Response `200`

```json
{
  "user_id": 1,
  "name": "Taro",
  "email": "taro@example.com",
  "points": 120,
  "age_group": "30s",
  "user_type": "general"
}
```

### `GET /users/:id/history`

- 認証: ユーザーまたは管理者
- 概要: 参加履歴とポイント取引履歴の取得

Rules

- 一般ユーザーは自分自身の `:id` のみ取得可
- 管理者は任意ユーザーを取得可

Response `200`

```json
{
  "participations": [
    {
      "participation_id": 1,
      "participated_at": "2026-05-26T01:00:00.000Z",
      "granted_points": 100,
      "event_id": 10,
      "event_name": "地域清掃イベント",
      "event_datetime": "2026-05-25T01:00:00.000Z",
      "location": "中央公園"
    }
  ],
  "transactions": [
    {
      "transaction_id": 1,
      "type": "exchange",
      "points": 200,
      "created_at": "2026-05-26T02:00:00.000Z",
      "service_id": 3,
      "service_name": "コーヒー無料券",
      "store_name": "Link Cafe"
    }
  ]
}
```

## Events

### `GET /events`

- 認証: ユーザー
- 概要: イベント一覧取得

Response `200`

```json
[
  {
    "event_id": 10,
    "event_name": "地域清掃イベント",
    "event_datetime": "2026-05-25T01:00:00.000Z",
    "location": "中央公園",
    "grant_points": 100
  }
]
```

### `POST /events/participate`

- 認証: ユーザー
- 概要: イベント参加登録とポイント付与

Request body

```json
{
  "event_id": 10
}
```

Notes

- 同じユーザーは同一イベントに 1 回のみ参加可
- 成功時に `users.points` と `point_transactions` が更新されます

Response `201`

```json
{
  "message": "Event participation registered successfully.",
  "event_id": 10,
  "granted_points": 100,
  "current_points": 300
}
```

## Points

### `GET /points/services`

- 認証: ユーザー
- 概要: ポイント交換可能サービス一覧取得

Response `200`

```json
[
  {
    "service_id": 3,
    "service_name": "コーヒー無料券",
    "required_points": 200,
    "store_id": 1,
    "store_name": "Link Cafe"
  }
]
```

### `POST /points/exchange`

- 認証: ユーザー
- 概要: ポイント交換実行

Request body

```json
{
  "service_id": 3
}
```

Notes

- ポイント不足の場合は `400`
- 成功時に `users.points` と `point_transactions` が更新されます

Response `200`

```json
{
  "message": "Point exchange completed successfully.",
  "service_id": 3,
  "service_name": "コーヒー無料券",
  "used_points": 200,
  "current_points": 100
}
```

## Admin

以下はすべて管理者トークン必須です。

### `GET /admin/events`

- 概要: イベント一覧取得

Response `200`

```json
[
  {
    "event_id": 10,
    "event_name": "地域清掃イベント",
    "event_datetime": "2026-05-25T01:00:00.000Z",
    "location": "中央公園",
    "grant_points": 100,
    "created_at": "2026-05-20T00:00:00.000Z"
  }
]
```

### `POST /admin/events`

- 概要: イベント作成

Request body

```json
{
  "event_name": "地域清掃イベント",
  "event_datetime": "2026-05-25 10:00:00",
  "location": "中央公園",
  "grant_points": 100
}
```

Response `201`

```json
{
  "message": "Event created successfully.",
  "event_id": 10
}
```

### `PUT /admin/events/:id`

- 概要: イベント更新

Request body

```json
{
  "event_name": "地域清掃イベント",
  "event_datetime": "2026-05-25 10:00:00",
  "location": "中央公園",
  "grant_points": 120
}
```

Response `200`

```json
{
  "message": "Event updated successfully."
}
```

### `GET /admin/stores`

- 概要: 店舗一覧取得

Response `200`

```json
[
  {
    "store_id": 1,
    "store_name": "Link Cafe",
    "created_at": "2026-05-20T00:00:00.000Z"
  }
]
```

### `POST /admin/stores`

- 概要: 店舗作成

Request body

```json
{
  "store_name": "Link Cafe"
}
```

Response `201`

```json
{
  "message": "Store created successfully.",
  "store_id": 1
}
```

### `PUT /admin/stores/:id`

- 概要: 店舗更新

Request body

```json
{
  "store_name": "Link Cafe"
}
```

Response `200`

```json
{
  "message": "Store updated successfully."
}
```

### `GET /admin/services`

- 概要: サービス一覧取得

Response `200`

```json
[
  {
    "service_id": 3,
    "store_id": 1,
    "service_name": "コーヒー無料券",
    "required_points": 200,
    "created_at": "2026-05-20T00:00:00.000Z",
    "store_name": "Link Cafe"
  }
]
```

### `POST /admin/services`

- 概要: サービス作成

Request body

```json
{
  "store_id": 1,
  "service_name": "コーヒー無料券",
  "required_points": 200
}
```

Response `201`

```json
{
  "message": "Service created successfully.",
  "service_id": 3
}
```

### `GET /admin/stats`

- 概要: 集計情報取得

Response `200`

```json
{
  "total_participations": 12,
  "total_granted_points": 840,
  "total_exchanges": 5
}
```
