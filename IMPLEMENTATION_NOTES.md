# IMPLEMENTATION_NOTES

`FEATURE_IMPLEMENTATION_PLAN.md` を元にした実装時の記録です。

## 実装範囲

- backend
  - ポイント購入、イベントいいね、交換サービスお気に入り、QR/check-in code 参加を追加
  - パスワード再発行、パスワード変更、メール変更、アカウント削除、ユーザー設定を追加
  - mock 支払方法、通知、問い合わせ/不具合報告を追加
  - 管理者の公開停止、削除、ユーザー管理、通知配信、問い合わせ管理、詳細統計を追加
  - SQLite schema と MySQL 参考 schema を更新
  - auth 系 API に簡易 rate limit を追加
  - production では `JWT_SECRET` 未設定を起動エラーに変更
- frontend
  - 正式 UI 差し替え前の仮実装であることを維持
  - 一般ユーザー操作、QR/check-in、購入、支払方法、通知、問い合わせ、アカウント設定を追加
  - 管理者ログインと管理者操作画面を追加
  - QR は `BarcodeDetector` 対応ブラウザではカメラ読み取り、非対応では check-in code 手入力 fallback
- test
  - `backend/scripts/smokeTest.js` を追加
  - root `npm test` で backend smoke と frontend build を実行

## 予定外のエラーと対応

- 即席 API smoke 実行時、fetch helper が `Content-Type: application/json` を上書きして `/events/check-in` が `400 Check-in code is required.` になった。
  - 原因: テスト用 fetch の headers merge 順序ミスで Express が JSON body を読めなかった。
  - 対応: 恒久化した `backend/scripts/smokeTest.js` では headers を正しく merge する形に修正済み。
- ローカル dev server 停止時、PowerShell 関数の引数名に `$pid` を使ったため read-only 変数と衝突した。
  - 原因: PowerShell の組み込み `$PID` と同名扱いになった。
  - 対応: 対象 PID を明示して停止。リポジトリ内コードへの変更は不要。

## 後続で判断が必要な点

- 決済は mock 実装。実決済連携、返金、二重決済防止、決済 webhook は未接続。
- パスワード再発行は開発時に `reset_token` を response に返す。本番ではメール送信または外部認証基盤が必要。
- メール変更は確認メールなしで即時更新。本番ではメール所有確認フローが必要。
- アカウント削除は物理削除。監査や法令要件がある場合は論理削除へ変更が必要。
- MySQL runtime はこの環境に DB インフラがないため未検証。SQLite smoke test と schema.sql 更新までは実施済み。
- 正式 UI 設計図は未反映。現在の画面は意図的に破線、TEMP 表示、仮文言を残している。

## 検証結果

```powershell
npm test
```

- backend smoke test passed
- `tsc --noEmit`
- `vite build`

ブラウザ相当確認では、一般ユーザーログイン、イベント参加、管理者ログイン画面表示を確認済み。
