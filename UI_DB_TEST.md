# UI DB Test

UI 操作で DB の内容が変わるかを確認するためのローカル検証手順です。  
現在の既定 DB は `sqlite` です。ファイルは `backend/database/dev.sqlite` に作成されます。

## 事前準備

```powershell
Copy-Item .env.example .env
npm install
npm run setup
```

## DB 初期化

```powershell
npm run db:reset
```

次回の backend 起動時に schema と seed が自動作成されます。

## 起動

```powershell
npm run dev
```

- backend: `http://127.0.0.1:3000`
- frontend: `http://127.0.0.1:5173`

## ログイン用 seed ユーザー

- Email: `demo@example.com`
- Password: `password123`

## UI での確認ポイント

- ログイン画面
  - 上記 seed ユーザーでログインする
- イベント画面
  - イベントカードをクリックすると `POST /events/participate` が呼ばれる
  - 成功すると `users.points` と `participations` と `point_transactions` が更新される
- ウォレット画面
  - 商品カードをクリックすると `POST /points/exchange` が呼ばれる
  - 成功すると `users.points` と `point_transactions` が更新される

## DB の確認

```powershell
npm run db:report
```

確認できる内容

- `users`
- `participations`
- `point_transactions`

## 再検証したい場合

```powershell
npm run db:reset
```

その後に backend を再起動してください。

## 3000 番 port が埋まっている場合

backend

```powershell
$env:PORT='3001'
npm run dev:backend
```

frontend

```powershell
$env:VITE_API_BASE_URL='http://127.0.0.1:3001'
npm run dev:frontend
```
