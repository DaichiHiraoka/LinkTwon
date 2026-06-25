# LinkTwon パートナーポータル Figma再構築仕様

このドキュメントは、`UI/partner-portal-screens` のHTMLモックをFigma上で再構築するための色・サイズ・余白・コンポーネント仕様です。

対象画面はイベント主催者向けのイベント受付画面 `E-01` から `E-08`、商店向けの商品交換画面 `S-01` から `S-08` です。

## 基本方針

- エンドユーザー向けUIとは別アプリとして識別できるよう、パートナーポータルは赤基調にする。
- ただし形状、余白、タッチサイズはエンドユーザーUIと同じく、業務システム風ではなく一般ユーザー向けアプリに近い柔らかい見た目にする。
- 各画面の主役アクションを1つに絞る。
- Figmaでは `2100 x 1300` のタブレット横向きフレームを基準サイズとして作成する。
- HTMLモックでは閲覧しやすいよう `.tablet-frame` に `scale(0.6)` が指定されているが、Figma再構築時は縮小前の `2100 x 1300` を使う。

## フレーム

| 項目 | 値 |
|---|---:|
| 基準フレーム幅 | `2100px` |
| 基準フレーム高さ | `1300px` |
| フレーム内余白 | 上下 `60px` / 左右 `80px` |
| フレーム角丸 | `32px` |
| 背景色 | `#FFF1F2` |
| HTML表示時の縮小率 | `60%` |

Figmaでは外側にブラウザ表示用のグレー背景を置かず、`2100 x 1300` のアプリ画面そのものをフレーム化する。

## カラートークン

### ブランドカラー

| トークン | 用途 | 値 |
|---|---|---|
| `primary` | イベント主催者UIのCTA、ロゴ、QR枠、成功表示 | `#DC2626` |
| `primary-dark` | イベント主催者UIの強調テキスト | `#7F1D1D` |
| `primary-soft` | イベント主催者UIの淡い背景 | `rgba(220, 38, 38, 0.12)` |
| `primary-mid` | イベント主催者UIの中間濃度背景 | `rgba(220, 38, 38, 0.25)` |
| `accent` | 商店UIのCTA、ロゴ、QR枠、成功表示 | `#E11D48` |
| `accent-dark` | 商店UIの強調テキスト | `#9F1239` |
| `accent-soft` | 商店UIの淡い背景 | `rgba(225, 29, 72, 0.14)` |

### サーフェス

| トークン | 用途 | 値 |
|---|---|---|
| `bg` | アプリ背景 | `#FFF1F2` |
| `card` | カード、ボタン、モーダル背景 | `#FFFFFF` |
| `card-soft` | 補助カード背景 | `#FFF7F7` |
| `browser-bg` | HTMLカタログ表示時の外側背景 | `#D9D9D9` |

### テキスト・線

| トークン | 用途 | 値 |
|---|---|---|
| `ink` | 通常テキスト | `#1A1A1A` |
| `ink-strong` | 最強調テキスト | `#000000` |
| `ink-muted` | 補助テキスト | `#5A5959` |
| `ink-soft` | 60%黒の説明テキスト | `rgba(0, 0, 0, 0.6)` |
| `ink-faint` | 40%黒の薄いテキスト | `rgba(0, 0, 0, 0.4)` |
| `line` | 境界線 | `rgba(0, 0, 0, 0.1)` |

### 状態色

| トークン | 用途 | 値 |
|---|---|---|
| `success` | 汎用成功色。現行UIでは成功チェックには使わず、補助用途のみ | `#2E7D32` |
| `success-soft` | 汎用成功背景 | `rgba(46, 125, 50, 0.12)` |
| `warn` | 警告・復旧可能エラー。白地でも見やすい暗めの黄色 | `#A16207` |
| `warn-soft` | 警告背景 | `rgba(161, 98, 7, 0.14)` |
| `error` | 致命エラー、コードエラー | `#B91C1C` |
| `error-soft` | エラー背景 | `rgba(185, 28, 28, 0.1)` |

## 影

| トークン | 用途 | 値 |
|---|---|---|
| `shadow-card` | 通常カード、アイコンボタン、カウンター | `0 4px 24px rgba(127, 29, 29, 0.06)` |
| `shadow-elev` | ヒーローカード、モーダル、QR読み取り領域 | `0 8px 32px rgba(127, 29, 29, 0.14)` |
| `hero-brand-shadow-event` | イベント主催者の大型ロゴ | `0 12px 32px rgba(220, 38, 38, 0.3)` |
| `hero-brand-shadow-store` | 商店の大型ロゴ | `0 12px 32px rgba(225, 29, 72, 0.3)` |
| `success-shadow-event` | イベント主催者の成功チェック | `0 16px 48px rgba(220, 38, 38, 0.32)` |
| `success-shadow-store` | 商店の成功チェック | `0 16px 48px rgba(225, 29, 72, 0.32)` |

## タイポグラフィ

| 用途 | Font family | Size | Weight | Line height / 備考 |
|---|---|---:|---:|---|
| 日本語全体 | `Noto Sans JP`, `Yu Gothic`, `Hiragino Sans`, `system-ui`, `sans-serif` | - | - | 基本文字 |
| 英数字・ID | `Inter`, `system-ui`, `sans-serif` | - | - | ロゴ文字、コード入力、数値 |
| ブランド名 | 日本語フォント | `36px` | `700` | `letter-spacing: -0.01em` |
| ブランド補足 | 日本語フォント | `18px` | normal | `ink-soft` |
| コンテキスト名 | 日本語フォント | `22px` | `700` | 右上の組織名・店舗名 |
| コンテキスト補足 | 日本語フォント | `16px` | normal | `ink-soft` |
| 画面見出し | 日本語フォント | `36px` | `700` | 例: 担当のイベント、取扱い商品 |
| 大型ブランド名 | 日本語フォント | `56px` | `700` | 中央ログイン系 |
| 大型ブランド補足 | 日本語フォント | `24px` | normal | 中央ログイン系 |
| ボタン | 日本語フォント | `22px` | `700` | `.btn` |
| XLボタン | 日本語フォント | `28px` | `700` | `.btn-xl` |
| 入力欄 | 日本語フォント | `22px` | normal | `.input` |
| コード入力 | 英数字フォント | `28px` | normal | `letter-spacing: 0.08em` |
| カードタイトル | 日本語フォント | `26px` | `700` | `line-height: 1.35` |
| カードメタ | 日本語フォント | `18px` | normal | `ink-soft` |
| ポイントピル | 日本語フォント | `20px` | `700` | |
| スキャン対象タイトル | 日本語フォント | `52px` | `700` | `line-height: 1.25` |
| スキャンメタ | 日本語フォント | `22px` | normal | |
| 大型ポイント | 英数字優先 | `56px` | `800` | `pt`部分は `28px`, `700` |
| モーダル見出し | 日本語フォント | `36px` | `700` | 中央揃え |
| モーダル対象者名 | 日本語フォント | `48px` | `700` | |
| モーダルポイント値 | 英数字優先 | `64px` | `800` | `pt`部分は `32px` |
| 成功メッセージ | 日本語フォント | `56px` | `700` | |
| 成功対象者行 | 日本語フォント | `32px` | normal | 氏名のみ `700` |
| エラーメッセージ | 日本語フォント | `48px` | `700` | |
| エラー補足 | 日本語フォント | `24px` | normal | 最大幅 `720px` |
| フレームID | 英数字フォント | `14px` | `700` | `letter-spacing: 0.08em` |

## 角丸

| トークン | 用途 | 値 |
|---|---|---:|
| `r-button` | 通常ボタン | `20px` |
| `r-input` | 入力欄、エラーメッセージ | `16px` |
| `r-card` | カード、ポイント表示、モーダル内ブロック | `32px` |
| `r-hero` | ヒーローカード、モーダル、QR読み取り領域 | `40px` |
| `brand-mark` | ヘッダーロゴ | `18px` |
| `hero-brand-mark` | 中央大型ロゴ | `40px` |
| `icon-btn` | アイコンボタン | `20px` |
| `qr-frame` | QR表示枠 | `36px` |
| `qr-corners` | QR枠内コーナー | `28px` |
| `camera-viewfinder` | カメラ領域 | `36px` |
| `camera-close` | カメラ閉じるボタン | `24px` |
| `pill` | ポイントピル | `999px` |
| `counter` | カウンター | `24px` |

## 共通レイアウト

### ヘッダー

| 要素 | 仕様 |
|---|---|
| `.app-header` | 横並び、中央揃え、左右端配置、下余白 `56px` |
| `.brand` | 横並び、中央揃え、gap `18px` |
| `.brand-mark` | `60 x 60px`, 角丸 `18px`, 背景はイベント `primary` / 商店 `accent` |
| `.brand-mark` 文字 | `L`, 白、`28px`, `800`, `Inter` |
| `.brand-name` | `36px`, `700` |
| `.brand-sub` | `18px`, `ink-soft`, 上余白 `2px` |
| `.context` | 右揃え |
| `.context-name` | `22px`, `700` |
| `.context-meta` | `16px`, `ink-soft`, 上余白 `4px` |
| `.header-actions` | 横並び、gap `16px` |

### フレームID

| 項目 | 値 |
|---|---:|
| 配置 | 右下固定 |
| bottom | `28px` |
| right | `36px` |
| font size | `14px` |
| color | `ink-faint` |
| letter spacing | `0.08em` |

## コンポーネント

### ボタン

| クラス | 用途 | サイズ・色 |
|---|---|---|
| `.btn` | 標準ボタン | 高さ `88px`, 左右padding `36px`, 角丸 `20px`, font `22px/700`, gap `14px` |
| `.btn-primary` | 主CTA | 背景 イベント `#DC2626` / 商店 `#E11D48`, 文字 `#FFFFFF` |
| `.btn-outline` | 副ボタン | 背景 `#FFFFFF`, 文字 `#1A1A1A`, border `2px solid rgba(0,0,0,0.1)` |
| `.btn-ghost` | 低優先ボタン | 背景透明, 文字 `#5A5959`, 高さ `64px`, font `18px` |
| `.btn-block` | 横幅いっぱい | width `100%` |
| `.btn-xl` | 大型CTA | 高さ `112px`, font `28px` |

### 入力欄

| 項目 | 値 |
|---|---:|
| 高さ | `80px` |
| 背景 | `#FFFFFF` |
| border | `2px solid rgba(0,0,0,0.1)` |
| border radius | `16px` |
| padding | 左右 `24px` |
| font size | `22px` |
| placeholder | `rgba(0,0,0,0.4)` |
| focus border | イベント `#DC2626` / 商店 `#E11D48` |
| error background | `rgba(185,28,28,0.1)` |
| textarea min-height | `180px` |
| textarea padding | 上下 `20px` / 左右 `24px` |
| textarea line-height | `1.6` |

### カード

| クラス | 用途 | 仕様 |
|---|---|---|
| `.card` | 通常カード | 背景 `#FFFFFF`, 角丸 `32px`, padding `40px`, shadow-card |
| `.card-hero` | 強調カード | 背景 `#FFFFFF`, 角丸 `40px`, padding `56px`, shadow-elev |

### 中央ログイン系

対象: `E-01`, `E-02`, `S-01`, `S-02`

| 要素 | 値 |
|---|---:|
| `.center-stage` | grid center, min-height `920px` |
| `.center-stage-inner` | width `880px` |
| `.hero-brand` | text-align center, margin-bottom `56px` |
| `.hero-brand .mark` | `132 x 132px`, 角丸 `40px`, font `60px/800`, 下余白 `24px` |
| `.hero-brand .name` | `56px`, `700`, `letter-spacing: -0.02em` |
| `.hero-brand .sub` | `24px`, `ink-soft`, 上余白 `12px` |
| `.code-form` | grid, gap `24px` |
| `.code-form label` | `22px`, `700`, center |
| `.code-form .input` | center, `28px`, `Inter`, `letter-spacing: 0.08em` |
| `.submit-row` | margin-top `8px` |
| `.help` | center, margin-top `12px` |
| `.help a` | `18px`, `ink-soft`, underline, underline offset `4px` |
| `.error-msg` | 背景 `error-soft`, 文字 `error`, 角丸 `16px`, padding `16px 24px`, center, `18px/700` |

### 一覧カード

対象: `E-03`, `S-03`

| 要素 | 値 |
|---|---:|
| `.item-grid` | 3列均等、gap `32px` |
| `.item-card` | 背景 `#FFFFFF`, 角丸 `32px`, overflow hidden, shadow-card |
| `.item-card` rows | `280px` サムネイル + 残り本文 |
| `.thumb` | 高さ `280px`, grid center, font `80px` |
| イベントサムネ背景 | `primary-soft` |
| イベントサムネ文字 | `primary` |
| 商店サムネ背景 | `accent-soft` |
| 商店サムネ文字 | `accent` |
| `.body` | padding 上下 `28px`, 左右 `32px`, gap `12px` |
| `.title` | `26px`, `700`, line-height `1.35` |
| `.meta` | `18px`, `ink-soft`, flex wrap, gap `18px` |
| `.points-pill` | padding `6px 16px`, radius `999px`, font `20px/700`, width fit-content |
| イベントポイントピル | 背景 `primary-soft`, 文字 `primary-dark` |
| 商店ポイントピル | 背景 `accent-soft`, 文字 `accent-dark` |

### QR読み取り画面

対象: `E-04`, `S-04`

| 要素 | 値 |
|---|---:|
| `.scan-stage` | 2列grid、左 `1fr` / 右 `720px`, gap `48px`, align center |
| `.scan-info` | grid, gap `28px`, padding `32px 8px` |
| `.label` | `20px`, `700`, uppercase, `letter-spacing: 0.06em`, `ink-soft` |
| `.target-title` | `52px`, `700`, line-height `1.25`, `letter-spacing: -0.01em` |
| `.target-meta` | grid, gap `12px`, font `22px`, color `ink-muted` |
| `.target-meta .row` | flex, align center, gap `16px` |
| `.target-meta .icon` | `40 x 40px`, 角丸 `12px`, font `20px`, 背景はsoft色 |
| `.points-large` | font `56px/800`, padding `20px 32px`, 角丸 `28px`, width fit-content |
| `.scan-target` | 背景 `#FFFFFF`, 角丸 `40px`, padding `48px`, shadow-elev, grid gap `32px`, center |
| `.qr-frame` | `480 x 480px`, 背景 `#FFF1F2`, 角丸 `36px`, center |
| `.qr-frame .corners` | inset `24px`, border `6px`, 角丸 `28px` |
| `.qr-icon` | font `180px`, brand color |
| `.prompt` | `32px`, `700`, center |
| `.sub` | `20px`, `ink-soft`, center |
| 手入力ボタン | 高さ `64px`, font `18px`, outline style |

### カメラオーバーレイ

カメラ使用中の状態を表すための全面オーバーレイ。

| 要素 | 値 |
|---|---:|
| `.camera-overlay` | absolute inset `0`, 背景 `rgba(0,0,0,0.92)`, center, z-index `10`, 角丸 `32px` |
| `.camera-viewfinder` | `720 x 720px`, 背景 `#0A0A0A`, 角丸 `36px`, overflow hidden |
| `.camera-viewfinder .corner` | `64 x 64px`, border `6px solid brand color` |
| corner offset | top/left/right/bottom `60px` |
| corner radius | `16px` |
| `.camera-scan-line` | left/right `60px`, top `50%`, height `4px`, brand color, glow `0 0 24px` |
| `.camera-prompt` | 白、`32px`, `700`, center, margin-top `36px` |
| `.camera-close` | top/right `60px`, `80 x 80px`, 背景 `rgba(255,255,255,0.12)`, 白, 角丸 `24px`, font `32px` |

### 確認モーダル

対象: `E-06`, `S-06`

| 要素 | 値 |
|---|---:|
| `.modal-overlay` | absolute inset `0`, 背景 `rgba(0,0,0,0.5)`, center, z-index `10`, 角丸 `32px` |
| 背景コンテンツ | HTMLでは `opacity: 0.3` |
| `.modal` | width `880px`, 背景 `#FFFFFF`, 角丸 `40px`, padding `56px`, shadow-elev |
| `.modal h2` | `36px`, `700`, center, margin-bottom `32px` |
| `.recipient` | center, margin-bottom `32px` |
| `.recipient .name` | `48px`, `700`, margin-bottom `8px` |
| `.recipient .id` | `18px`, `ink-soft`, `Inter` |
| `.delta` | center, brand soft背景, padding `32px`, 角丸 `32px`, margin-bottom `24px` |
| `.delta .label` | `18px`, `ink-soft`, margin-bottom `8px` |
| `.delta .value` | `64px`, `800`, brand dark, line-height `1` |
| `.delta .for` | `20px`, `ink-muted`, margin-top `16px` |
| `.actions` | 2列grid、左 `1fr` / 右 `1.4fr`, gap `20px`, margin-top `8px` |

### 成功画面

対象: `E-07`, `S-07`

| 要素 | 値 |
|---|---:|
| `.success-stage` | grid center, text-align center, padding `80px 0` |
| `.check` | `220 x 220px`, 円形, 背景 brand color, 白, font `140px`, margin-bottom `40px` |
| `.msg` | `56px`, `700`, margin-bottom `24px` |
| `.name-line` | `32px`, margin-bottom `16px` |
| `.delta` | `28px`, `700`, brand dark, brand soft背景, padding `12px 32px`, 角丸 `24px`, margin-bottom `56px` |
| `.next` | flex, gap `20px` |

### エラー・警告画面

対象: `E-08`, `S-08`

| 要素 | 値 |
|---|---:|
| `.alert-stage` | grid center, text-align center, padding `80px 0` |
| `.mark` | `200 x 200px`, 円形, font `120px`, margin-bottom `40px` |
| warn表示 | 背景 `warn-soft`, 文字 `warn` |
| error表示 | 背景 `error-soft`, 文字 `error` |
| `.msg` | `48px`, `700`, margin-bottom `16px` |
| `.hint` | `24px`, `ink-soft`, margin-bottom `48px`, max-width `720px` |
| `.next` | flex, gap `20px` |

### カウンター

| 要素 | 値 |
|---|---:|
| `.counter` | 背景 `#FFFFFF`, 角丸 `24px`, padding `20px 28px`, shadow-card, flex center, gap `16px` |
| `.counter .num` | `40px`, `800`, `Inter`, brand dark |
| `.counter .lbl` | `16px`, `700`, `ink-soft` |

## テーマ差分

### イベント主催者テーマ

| 項目 | 値 |
|---|---|
| body class | なし |
| 主色 | `#DC2626` |
| 濃色 | `#7F1D1D` |
| 淡色 | `rgba(220, 38, 38, 0.12)` |
| 用途 | イベント受付、チェックイン、ポイント付与 |
| 画面ID | `E-01` から `E-08` |

### 商店テーマ

| 項目 | 値 |
|---|---|
| body class | `theme-store` |
| 主色 | `#E11D48` |
| 濃色 | `#9F1239` |
| 淡色 | `rgba(225, 29, 72, 0.14)` |
| 用途 | 商品交換、ポイント消費 |
| 画面ID | `S-01` から `S-08` |

## 画面別仕様

### E-01 アクセスコード

- 中央ステージ構成。
- ブランド大型ロゴ、アプリ名、サブタイトル「イベント受付」を表示。
- アクセスコード入力欄は中央揃え。
- CTAは `btn-primary btn-block btn-xl` の「続ける」。
- 下部に「コードを忘れた方」リンク。

### E-02 コードエラー

- E-01と同一レイアウト。
- 入力欄に `.error` を付与。
- 入力欄下に `.error-msg` を追加。
- 代表文言: `コードが確認できませんでした`。

### E-03 イベント一覧

- ヘッダー左にLink Townブランド、右に主催組織名と日付。
- 見出しは `担当のイベント`、`36px/700`、下余白 `32px`。
- 3列カードで担当イベントを表示。
- 各カードはサムネイル絵文字、タイトル、日時・場所、付与ポイントピル。

### E-04 QR受付

- ヘッダー左に戻るボタンとイベント名、右に受付済カウンター。
- 2列レイアウト。
- 左は付与ポイント、開催日時、場所、手入力ボタン。
- 右はQR表示枠と `QRコードをかざしてください`。

### E-05 手入力

- E-04の派生。
- QR読み取りの代わりにテキスト入力エリアを置く。
- 手入力欄は `textarea.input`、最小高さ `180px`。
- 入力後の確認操作は大型CTAを使う。

### E-06 受付確認

- 背景にE-04相当の画面を `opacity: 0.3` で残す。
- 全面に `rgba(0,0,0,0.5)` のモーダルオーバーレイ。
- モーダル幅 `880px`。
- 対象者名を `48px/700` で大きく表示。
- `+100pt` を `64px/800` で表示。
- アクションは左 `キャンセル`、右 `受付する`。右を1.4倍幅にする。

### E-07 受付完了

- ヘッダーと受付済カウンターを表示。
- 中央に直径 `220px` の赤い成功チェック。
- メッセージ `受付しました`。
- 対象者名、付与ポイント、次アクション `続けて受付する`。

### E-08 受付エラー

- ヘッダーと受付済カウンターを表示。
- 中央に警告アイコン。
- 代表エラーはQR期限切れ。
- `QRの有効期限が切れています` と補足文を表示。
- CTAは `もう一度読み取る`。

### S-01 アクセスコード

- E-01と同一構造。
- `body.theme-store` を使い、ブランド色をローズ赤に変更。
- サブタイトルは `商品交換`。

### S-02 コードエラー

- S-01と同一構造。
- 入力欄エラーとエラーメッセージを表示。

### S-03 商品一覧

- ヘッダー左にLink Townブランド、右に店舗名と住所。
- 見出しは `取扱い商品`。
- 3列カードで商品を表示。
- 各カードはサムネイル絵文字、商品名、在庫、必要ポイントピル。

### S-04 QR交換

- E-04と同一構造。
- 左側の大型ポイントは消費ポイントを表す。
- 商品名、必要ポイント、在庫情報を表示。
- 右側はQR表示枠とスキャン案内。

### S-05 手入力

- S-04の派生。
- QR内容をテキスト入力する。
- 入力欄、確認CTAはE-05と同じ寸法。

### S-06 交換確認

- E-06と同一構造。
- ポイント値は減算表示、例: `-180pt`。
- 補足には交換対象の商品名を表示。
- アクションは左 `キャンセル`、右 `交換する`。

### S-07 交換完了

- E-07と同一構造。
- メッセージは交換完了文言。
- 対象者名、商品名、消費ポイントを表示。
- CTAは続けて交換する操作。

### S-08 交換エラー

- E-08と同一構造。
- 代表エラーはポイント不足。
- 必要ポイントと残高の対比を補足として表示する。

## Figmaコンポーネント化推奨

| コンポーネント名 | Variant / Property |
|---|---|
| `Partner/Header` | `theme=event/store`, `mode=brand/context/back`, `counter=true/false` |
| `Partner/Button` | `type=primary/outline/ghost`, `size=normal/xl`, `width=auto/block` |
| `Partner/Input` | `state=default/focus/error`, `type=text/code/textarea` |
| `Partner/LogoMark` | `theme=event/store`, `size=header/hero` |
| `Partner/ItemCard` | `theme=event/store`, `content=event/product` |
| `Partner/PointPill` | `theme=event/store`, `sign=plus/minus/none` |
| `Partner/ScanTarget` | `theme=event/store` |
| `Partner/ModalConfirm` | `theme=event/store`, `kind=checkin/exchange` |
| `Partner/SuccessState` | `theme=event/store`, `kind=checkin/exchange` |
| `Partner/AlertState` | `tone=warn/error`, `kind=expired/insufficient/duplicate/invalid/network` |
| `Partner/Counter` | `theme=event/store` |

## 画面一覧

| ID | 画面名 | テーマ | 主要コンポーネント |
|---|---|---|---|
| `E-01` | アクセスコード | event | CenterStage, HeroBrand, CodeForm |
| `E-02` | コードエラー | event | CenterStage, HeroBrand, CodeForm error |
| `E-03` | イベント一覧 | event | Header, ItemGrid, ItemCard |
| `E-04` | QR受付 | event | Header, Counter, ScanStage, ScanTarget |
| `E-05` | 手入力 | event | Header, Textarea, CTA |
| `E-06` | 受付確認 | event | ModalOverlay, ModalConfirm |
| `E-07` | 受付完了 | event | Header, SuccessState |
| `E-08` | 受付エラー | event | Header, AlertState |
| `S-01` | アクセスコード | store | CenterStage, HeroBrand, CodeForm |
| `S-02` | コードエラー | store | CenterStage, HeroBrand, CodeForm error |
| `S-03` | 商品一覧 | store | Header, ItemGrid, ItemCard |
| `S-04` | QR交換 | store | Header, Counter, ScanStage, ScanTarget |
| `S-05` | 手入力 | store | Header, Textarea, CTA |
| `S-06` | 交換確認 | store | ModalOverlay, ModalConfirm |
| `S-07` | 交換完了 | store | Header, SuccessState |
| `S-08` | 交換エラー | store | Header, AlertState |

## Figma作業時の注意

- `rgba(...)` 色はFigmaでは同じRGB値とOpacityで登録する。
- HTMLの絵文字サムネイルは仮素材。Figma再構築時はアイコン、写真、イラストへ差し替えてよいが、サムネイル領域は `280px` 高を維持する。
- 成功表示はあえて緑ではなくブランド赤を使う。赤基調アプリの世界観を保つため。
- 警告はブランド赤と混同しないよう暗めの黄色 `#A16207` を使う。明るいテーマは維持しつつ、白地に黄色の見づらさを避ける。
- `E-06` / `S-06` の背景は実装では画面上に存在する前画面を暗くする想定。Figmaでは前画面を複製して不透明度 `30%` にし、その上に黒50%オーバーレイを重ねると近い。
- 画面右下の `E—01` などのIDはカタログ確認用。実プロダクト画面には表示しない想定。

## 参照元

- HTMLカタログ: `UI/partner-portal-screens/index.html`
- 共通CSS: `UI/partner-portal-screens/styles.css`
- 概要README: `UI/partner-portal-screens/README.md`
