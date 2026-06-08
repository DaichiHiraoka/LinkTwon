# Link Town UI遷移図メモ

このメモは `linktown-full-ui-transition-map.png` の読み方と対象範囲を補足するものです。

## 対象範囲

- 現行UIで実装済みの画面
- UIとして追加が必要な画面
- イベント詳細などのモーダル
- 確認、成功、失敗、権限不足、セッション期限切れなどの状態表示
- APIエンドポイントの結果として必要になるUI状態
- 管理者用APIに対応する管理画面

## 異常系として含める状態

- 400: 入力不備、形式不正
- 401: セッション期限切れ、未ログイン
- 403: 権限不足
- 404: 対象データなし
- 409相当: 重複、競合、既に参加済みなど
- 429: レート制限
- 5xx: サーバー障害
- network/offline: 通信不可
- permission: カメラ権限拒否
- empty: 一覧0件
- loading/submitting: 読み込み中、送信中、二重送信防止

## 生成方法

```powershell
powershell -ExecutionPolicy Bypass -File UI\generate-full-ui-transition-map.ps1
```

出力:

```text
UI\linktown-full-ui-transition-map.png
```

