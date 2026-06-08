Add-Type -AssemblyName System.Drawing

$width = 7600
$height = 5200
$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Join-Path (Get-Location) "UI" }
$outputPath = Join-Path $scriptRoot "linktown-full-ui-transition-map.png"

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#F5F7FB"))

function ColorFromHex($hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function New-Brush($hex) {
  return New-Object System.Drawing.SolidBrush (ColorFromHex $hex)
}

function New-Pen($hex, $width = 2) {
  return New-Object System.Drawing.Pen (ColorFromHex $hex), $width
}

function New-UiFont($size, $style = [System.Drawing.FontStyle]::Regular) {
  return New-Object System.Drawing.Font("Yu Gothic", $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-RoundRectPath($x, $y, $w, $h, $r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-RoundRect($x, $y, $w, $h, $r, $fillHex, $strokeHex, $strokeWidth = 2, $dashed = $false) {
  $path = New-RoundRectPath $x $y $w $h $r
  $brush = New-Brush $fillHex
  $pen = New-Pen $strokeHex $strokeWidth
  if ($dashed) {
    $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  }
  $graphics.FillPath($brush, $path)
  $graphics.DrawPath($pen, $path)
  $brush.Dispose()
  $pen.Dispose()
  $path.Dispose()
}

function Draw-Text($text, $x, $y, $w, $h, $font, $hex = "#111827", $align = "Near", $lineAlign = "Near") {
  $brush = New-Brush $hex
  $rect = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::$align
  $format.LineAlignment = [System.Drawing.StringAlignment]::$lineAlign
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
  $graphics.DrawString($text, $font, $brush, $rect, $format)
  $brush.Dispose()
  $format.Dispose()
}

function Draw-CenteredText($text, $x, $y, $w, $h, $font, $hex = "#111827") {
  Draw-Text $text $x $y $w $h $font $hex "Center" "Center"
}

function Draw-Arrow($x1, $y1, $x2, $y2, $hex = "#64748B", $dashed = $false) {
  $pen = New-Pen $hex 4
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  if ($dashed) {
    $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  }
  $cap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(8, 11, $true)
  $pen.CustomEndCap = $cap
  $graphics.DrawLine($pen, $x1, $y1, $x2, $y2)
  $cap.Dispose()
  $pen.Dispose()
}

function Draw-Badge($label, $x, $y, $fillHex, $textHex) {
  Draw-RoundRect $x $y 96 32 16 $fillHex $fillHex 1 $false
  Draw-CenteredText $label $x ($y + 1) 96 30 (New-UiFont 17 ([System.Drawing.FontStyle]::Bold)) $textHex
}

function Get-CardStyle($kind) {
  switch ($kind) {
    "existing" { return @{ Label = "既存"; Fill = "#FFFFFF"; Stroke = "#2563EB"; BadgeFill = "#DBEAFE"; BadgeText = "#1D4ED8"; Dashed = $false } }
    "new" { return @{ Label = "追加"; Fill = "#FFFFFF"; Stroke = "#F59E0B"; BadgeFill = "#FEF3C7"; BadgeText = "#92400E"; Dashed = $true } }
    "modal" { return @{ Label = "modal"; Fill = "#FFFFFF"; Stroke = "#7C3AED"; BadgeFill = "#EDE9FE"; BadgeText = "#5B21B6"; Dashed = $true } }
    "state" { return @{ Label = "状態"; Fill = "#FFFFFF"; Stroke = "#0891B2"; BadgeFill = "#CFFAFE"; BadgeText = "#155E75"; Dashed = $true } }
    "error" { return @{ Label = "異常"; Fill = "#FFFFFF"; Stroke = "#DC2626"; BadgeFill = "#FEE2E2"; BadgeText = "#B91C1C"; Dashed = $true } }
    "admin" { return @{ Label = "admin"; Fill = "#FFFFFF"; Stroke = "#334155"; BadgeFill = "#E2E8F0"; BadgeText = "#334155"; Dashed = $true } }
    default { return @{ Label = "画面"; Fill = "#FFFFFF"; Stroke = "#64748B"; BadgeFill = "#E2E8F0"; BadgeText = "#334155"; Dashed = $false } }
  }
}

function Draw-Card($card, $x, $y, $w, $h) {
  $style = Get-CardStyle $card.Kind
  Draw-RoundRect $x $y $w $h 18 $style.Fill $style.Stroke 3 $style.Dashed
  Draw-Badge $style.Label ($x + $w - 112) ($y + 16) $style.BadgeFill $style.BadgeText
  Draw-Text $card.Title ($x + 18) ($y + 16) ($w - 132) 34 (New-UiFont 22 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
  Draw-Text $card.Endpoint ($x + 18) ($y + 54) ($w - 36) 25 (New-UiFont 16 ([System.Drawing.FontStyle]::Bold)) "#2563EB"
  Draw-Text $card.Note ($x + 18) ($y + 82) ($w - 36) ($h - 92) (New-UiFont 17) "#475569"
}

function Card($title, $kind, $endpoint, $note) {
  return [pscustomobject]@{
    Title = $title
    Kind = $kind
    Endpoint = $endpoint
    Note = $note
  }
}

function Draw-Lane($title, $subtitle, $cards, $x, $y, $laneW, $cardW = 390, $cardH = 148, $gap = 28) {
  $maxPerRow = [Math]::Max(1, [Math]::Floor(($laneW - 50 + $gap) / ($cardW + $gap)))
  $rows = [Math]::Ceiling($cards.Count / $maxPerRow)
  $laneH = 108 + ($rows * $cardH) + (($rows - 1) * 44) + 36

  Draw-RoundRect $x $y $laneW $laneH 26 "#FFFFFF" "#E2E8F0" 2 $false
  Draw-Text $title ($x + 34) ($y + 22) 980 38 (New-UiFont 30 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
  Draw-Text $subtitle ($x + 36) ($y + 62) ($laneW - 72) 30 (New-UiFont 20) "#64748B"

  $positions = @()
  for ($i = 0; $i -lt $cards.Count; $i++) {
    $row = [Math]::Floor($i / $maxPerRow)
    $col = $i % $maxPerRow
    $cx = $x + 34 + ($col * ($cardW + $gap))
    $cy = $y + 108 + ($row * ($cardH + 44))
    Draw-Card $cards[$i] $cx $cy $cardW $cardH
    $positions += [pscustomobject]@{ X = $cx; Y = $cy; W = $cardW; H = $cardH; Row = $row; Col = $col }
  }

  for ($i = 0; $i -lt ($positions.Count - 1); $i++) {
    $a = $positions[$i]
    $b = $positions[$i + 1]
    $isError = $cards[$i + 1].Kind -eq "error"
    $arrowColor = if ($isError) { "#DC2626" } else { "#64748B" }
    $dashed = $isError
    if ($a.Row -eq $b.Row) {
      Draw-Arrow ($a.X + $a.W + 6) ($a.Y + ($a.H / 2)) ($b.X - 8) ($b.Y + ($b.H / 2)) $arrowColor $dashed
    } else {
      Draw-Arrow ($a.X + ($a.W / 2)) ($a.Y + $a.H + 6) ($b.X + ($b.W / 2)) ($b.Y - 8) $arrowColor $dashed
    }
  }

  return $laneH
}

function Draw-ListCard($title, $items, $x, $y, $w, $h, $accent = "#2563EB") {
  Draw-RoundRect $x $y $w $h 22 "#FFFFFF" "#E2E8F0" 2 $false
  Draw-Text $title ($x + 28) ($y + 24) ($w - 56) 38 (New-UiFont 28 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
  $itemY = $y + 78
  foreach ($item in $items) {
    $brush = New-Brush $accent
    $graphics.FillEllipse($brush, $x + 30, $itemY + 9, 9, 9)
    $brush.Dispose()
    Draw-Text $item ($x + 52) $itemY ($w - 74) 42 (New-UiFont 20) "#475569"
    $itemY += 44
  }
}

function Draw-EndpointGroup($title, $text, $x, $y, $w, $h) {
  Draw-RoundRect $x $y $w $h 18 "#F8FAFC" "#CBD5E1" 2 $false
  Draw-Text $title ($x + 18) ($y + 16) ($w - 36) 30 (New-UiFont 22 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
  Draw-Text $text ($x + 18) ($y + 54) ($w - 36) ($h - 66) (New-UiFont 18) "#475569"
}

$titleFont = New-UiFont 58 ([System.Drawing.FontStyle]::Bold)
$subtitleFont = New-UiFont 27

Draw-Text "Link Town 全UI遷移図（通常系・異常系・モーダル・API結果状態）" 90 58 4300 74 $titleFont "#0F172A"
Draw-Text "現行UI、追加が必要な画面、APIエンドポイントの結果として必要になる状態画面/モーダルをまとめた完全版。" 94 136 4700 42 $subtitleFont "#475569"

Draw-RoundRect 5480 50 2020 126 30 "#FFFFFF" "#E2E8F0" 2 $false
Draw-Badge "既存" 5530 90 "#DBEAFE" "#1D4ED8"
Draw-Text "実装済み画面" 5646 94 190 30 (New-UiFont 19) "#334155"
Draw-Badge "追加" 5845 90 "#FEF3C7" "#92400E"
Draw-Text "追加画面/導線" 5961 94 210 30 (New-UiFont 19) "#334155"
Draw-Badge "modal" 6220 90 "#EDE9FE" "#5B21B6"
Draw-Text "確認/結果/詳細" 6336 94 210 30 (New-UiFont 19) "#334155"
Draw-Badge "異常" 6598 90 "#FEE2E2" "#B91C1C"
Draw-Text "エラー/失敗状態" 6714 94 220 30 (New-UiFont 19) "#334155"
Draw-Badge "状態" 6970 90 "#CFFAFE" "#155E75"
Draw-Text "loading/empty等" 7086 94 260 30 (New-UiFont 19) "#334155"

$leftX = 90
$leftY = 220
$leftW = 1320
Draw-ListCard "全画面共通で必要な状態" @(
  "Loading: 初回読み込み、API再取得、送信中、二重送信防止",
  "Empty: イベントなし、通知なし、履歴なし、問い合わせなし",
  "401: セッション期限切れ -> ローカルセッション削除 -> ログイン",
  "403: 権限不足 -> 操作不可メッセージ",
  "404: 対象なし -> 一覧へ戻す/再取得",
  "409/重複: 既に参加済み、既にお気に入り、メール重複",
  "429: レート制限 -> 待機案内",
  "5xx/Network: 再試行、オフライン、サーバー障害",
  "Confirm: 参加、キャンセル、交換、購入、削除、ログアウト",
  "Toast/Alert: 成功、失敗、保存完了、既読化完了"
) $leftX $leftY $leftW 650 "#DC2626"

Draw-ListCard "この図に含めた対象" @(
  "画面: ページとして表示するUI",
  "モーダル: 詳細、確認、成功/失敗、権限要求",
  "API結果状態: エンドポイントの成功/失敗で必要な表示",
  "管理者画面: admin endpoints に対応するCRUD/集計",
  "未実装でもアプリ利用時に必要になり得る遷移"
) $leftX 910 $leftW 430 "#7C3AED"

Draw-ListCard "優先実装の見方" @(
  "P1相当: 認証、チェックイン、交換/購入、通知、問い合わせ",
  "P2相当: 支払い方法、管理者CRUD、お気に入り実行",
  "P3相当: 詳細プロフィール、レポート拡張、細かな履歴表示",
  "異常系は各API実装より前に共通コンポーネント化するとよい"
) $leftX 1360 $leftW 350 "#F59E0B"

Draw-ListCard "画面遷移の前提" @(
  "通常画面は下部ナビまたは詳細から遷移",
  "異常系は画面遷移ではなくモーダル/トースト/インラインエラーも含む",
  "認証切れはどの画面からでもログインへ戻る",
  "管理者画面は一般ユーザー画面とセッション/権限を分ける",
  "DB/APIが返す状態はUIとして必ず表現する"
) $leftX 1728 $leftW 390 "#0891B2"

$mainX = 1500
$mainW = 6000
$y = 220

$authCards = @(
  ,@("ログイン", "existing", "POST /auth/login", "メール/パスワード。成功時はホームへ。")
  ,@("ログイン失敗", "error", "400/401/429", "未入力、不正認証、レート制限。フォーム内エラー。")
  ,@("新規登録", "new", "POST /auth/register", "氏名、メール、パスワード、年代、種別。")
  ,@("登録成功", "modal", "201 + token", "セッション保存後ホームへ。初回案内も可能。")
  ,@("登録失敗", "error", "400/duplicate", "メール重複、入力不正、弱いパスワード。")
  ,@("再設定依頼", "new", "POST /auth/password/reset-request", "メール入力。devではreset_token表示も想定。")
  ,@("再設定フォーム", "new", "POST /auth/password/reset", "token + 新パスワード。")
  ,@("再設定結果", "modal", "success/error", "成功はログインへ。期限切れ/使用済みは再依頼へ。")
  ,@("ログアウト確認", "modal", "local session", "確認後セッション削除してログインへ。")
  ,@("セッション期限切れ", "error", "401 from any API", "全画面共通。localStorage削除、ログインへ。")
) | ForEach-Object { Card $_[0] $_[1] $_[2] $_[3] }
$laneH = Draw-Lane "1. 認証・セッション" "ログイン、新規登録、パスワード再設定、ログアウト、401復帰を含む。" $authCards $mainX $y $mainW
$y += $laneH + 32

$homeCards = @(
  ,@("ホーム", "existing", "GET profile/events/history", "残高、予定イベント、おすすめイベント。")
  ,@("初期ロード", "state", "Promise.all", "profile/events/liked/services/settings/history を取得中。")
  ,@("ロード失敗", "error", "401/403/5xx/network", "認証切れはログイン。その他は再試行。")
  ,@("下部ナビ", "existing", "screen state", "ホーム/イベント/読取/ウォレット/アカウント。")
  ,@("メール/通知入口", "new", "GET /users/:id/notifications", "ヘッダーのメールアイコンから通知一覧へ。")
  ,@("ヘルプ入口", "new", "GET/POST /support/tickets", "ヘルプアイコンから問い合わせへ。")
  ,@("イベント詳細モーダル", "modal", "selectedEvent", "ホーム/イベント一覧から共通で開く。")
  ,@("空状態", "state", "empty data", "イベント、履歴、サービスが0件の場合。")
) | ForEach-Object { Card $_[0] $_[1] $_[2] $_[3] }
$laneH = Draw-Lane "2. ホーム・共通ナビ" "アプリ利用開始後に必ず通る共通画面と、全画面から起こり得る状態。" $homeCards $mainX $y $mainW
$y += $laneH + 32

$eventCards = @(
  ,@("イベント一覧", "existing", "GET /events", "おすすめタブ。liked/like_count も表示。")
  ,@("いいね済みタブ", "existing", "GET /users/:id/liked-events", "0件なら空状態。取得失敗時は再試行。")
  ,@("参加済みタブ", "existing", "GET /users/:id/history", "キャンセル導線を持つ。")
  ,@("イベント詳細", "modal", "event detail state", "応募、いいね、活動内容、メタ情報。")
  ,@("参加実行", "modal", "POST /events/participate", "確認 -> 送信中 -> 成功。")
  ,@("参加失敗", "error", "400/401/404/paused/duplicate", "重複、停止中、対象なし、認証切れ。")
  ,@("いいね切替", "modal", "POST/DELETE /events/:id/like", "成功は一覧/詳細を再取得。")
  ,@("いいね失敗", "error", "401/404/5xx", "詳細は開いたままエラー表示。")
  ,@("参加キャンセル確認", "modal", "DELETE /events/:id/participation", "取消確認、二重送信防止。")
  ,@("キャンセル結果", "modal", "success/404", "成功はポイント返還。未参加は404表示。")
  ,@("QR読取/手入力", "new", "POST /events/check-in", "カメラ読取、手入力、読み取り待機。")
  ,@("カメラ権限/失敗", "error", "permission/scan failure", "権限拒否、読み取り失敗、再試行。")
  ,@("チェックイン成功", "modal", "201 current_points", "ポイント付与、残高更新、履歴反映。")
  ,@("チェックイン失敗", "error", "invalid/expired/duplicate/401", "無効コード、期限切れ、参加済み。")
) | ForEach-Object { Card $_[0] $_[1] $_[2] $_[3] }
$laneH = Draw-Lane "3. イベント・参加・チェックイン" "一覧、詳細、応募、いいね、キャンセル、QR/コードチェックインと異常系。" $eventCards $mainX $y $mainW
$y += $laneH + 32

$walletCards = @(
  ,@("ウォレット", "existing", "GET profile/services", "残高、サービスカテゴリ、購入入口。")
  ,@("サービス一覧", "existing", "GET /points/services", "recommended タブ。favorited を反映。")
  ,@("お気に入りタブ", "new", "GET /users/:id/favorite-services", "API連携済みの0件/取得失敗状態も必要。")
  ,@("サービス詳細", "new", "service detail", "必要pt、店舗、利用条件、交換/お気に入り。")
  ,@("お気に入り切替", "modal", "POST/DELETE /points/services/:id/favorite", "成功/失敗トースト。")
  ,@("交換確認", "modal", "POST /points/exchange", "必要ポイント、残高、利用規約確認。")
  ,@("交換成功", "modal", "current_points", "クーポン/交換番号表示、履歴へ。")
  ,@("交換失敗", "error", "insufficient/paused/404/401", "ポイント不足、停止中、対象なし。")
  ,@("ポイント購入", "existing", "POST /points/purchase", "現状は静的。金額/pt選択が必要。")
  ,@("支払い方法選択", "new", "GET /users/:id/payment-methods", "未登録なら追加画面へ。")
  ,@("支払い方法管理", "new", "POST/DELETE payment-methods", "追加、削除、既定、保存失敗。")
  ,@("購入確認", "modal", "purchase request", "pt、金額、支払い方法、手数料確認。")
  ,@("購入結果", "modal", "paid/pending/failed/cancelled", "paidのみ残高加算。失敗は再試行。")
  ,@("取引/購入履歴", "new", "GET /users/:id/history/purchases", "付与、交換、購入の履歴表示。")
) | ForEach-Object { Card $_[0] $_[1] $_[2] $_[3] }
$laneH = Draw-Lane "4. ウォレット・ポイント交換・購入・支払い" "ポイント残高、交換、購入、支払い方法、履歴、各API結果状態。" $walletCards $mainX $y $mainW
$y += $laneH + 32

$accountCards = @(
  ,@("アカウント", "existing", "GET /users/:id/settings", "メール、通知、言語、文字サイズ、パスワード。")
  ,@("プロフィール編集", "new", "PUT/admin users or future user API", "氏名、年代、ユーザー種別など。")
  ,@("メール更新", "modal", "PUT /users/:id/email", "成功/重複/形式不正。")
  ,@("設定更新", "modal", "PUT /users/:id/settings", "通知、言語、文字サイズ。保存失敗も表示。")
  ,@("パスワード変更", "modal", "PUT /auth/password", "現パスワード確認、成功/不一致。")
  ,@("退会確認", "modal", "DELETE /users/:id", "危険操作確認。成功後ログインへ。")
  ,@("通知一覧", "new", "GET /users/:id/notifications", "未読/既読、空状態、取得失敗。")
  ,@("通知詳細/既読", "modal", "PUT /notifications/:id/read", "詳細表示、既読化、失敗時再試行。")
  ,@("問い合わせ一覧", "new", "GET /support/tickets", "自分の問い合わせ履歴、状態表示。")
  ,@("問い合わせ作成", "new", "POST /support/tickets", "support/bug、件名、本文、送信結果。")
  ,@("問い合わせ詳細", "modal", "ticket detail", "status、admin_note、更新履歴。")
  ,@("問い合わせ失敗", "error", "400/401/5xx", "入力不備、認証切れ、サーバー障害。")
) | ForEach-Object { Card $_[0] $_[1] $_[2] $_[3] }
$laneH = Draw-Lane "5. アカウント・通知・問い合わせ" "設定、退会、通知、問い合わせチケットと各保存/送信エラー。" $accountCards $mainX $y $mainW
$y += $laneH + 32

$adminCards = @(
  ,@("管理者ログイン", "new", "POST /auth/admin/login", "管理者ID/パスワード。一般ログインと分離。")
  ,@("管理者ログイン失敗", "error", "400/401/429", "入力不備、不正認証、レート制限。")
  ,@("ダッシュボード", "admin", "GET /admin/stats", "総ユーザー、イベント、交換、購入、問い合わせ。")
  ,@("イベント管理", "admin", "GET/POST/PUT/DELETE /admin/events", "作成、編集、停止、削除。")
  ,@("QRコード管理", "modal", "GET /admin/events/:id/check-in-code", "コード表示、再発行、期限表示。")
  ,@("店舗管理", "admin", "GET/POST/PUT/DELETE /admin/stores", "店舗作成、停止、削除。")
  ,@("サービス管理", "admin", "GET/POST/PUT/DELETE /admin/services", "交換メニュー、必要pt、公開状態。")
  ,@("ユーザー管理", "admin", "GET/PUT /admin/users", "検索、詳細、ポイント/属性編集。")
  ,@("通知配信", "admin", "POST /admin/notifications", "全体/個別配信、配信結果。")
  ,@("問い合わせ管理", "admin", "GET/PUT /admin/support/tickets", "status/admin_note更新。")
  ,@("管理者異常系", "error", "401/403/validation/5xx", "権限不足、入力不備、集計失敗。")
) | ForEach-Object { Card $_[0] $_[1] $_[2] $_[3] }
$laneH = Draw-Lane "6. 管理者UI" "admin endpoints に対応する管理画面、CRUD、集計、問い合わせ対応、異常系。" $adminCards $mainX $y $mainW
$y += $laneH + 32

$endpointY = $y
Draw-RoundRect $mainX $endpointY $mainW 790 26 "#FFFFFF" "#E2E8F0" 2 $false
Draw-Text "7. エンドポイント別 UI 表示カバレッジ" ($mainX + 34) ($endpointY + 24) 1120 40 (New-UiFont 30 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
Draw-Text "各APIは成功/失敗/空/認証切れ/権限不足/ネットワーク障害をUIで表現する。画面遷移がなくてもモーダル、トースト、インラインエラーとして扱う。" ($mainX + 36) ($endpointY + 66) ($mainW - 72) 32 (New-UiFont 20) "#64748B"

$groupY = $endpointY + 116
$groupW = 1140
$groupH = 190
$gx = $mainX + 34
Draw-EndpointGroup "Auth" "/auth/register`n/auth/login`n/auth/admin/login`n/auth/password/reset-request`n/auth/password/reset`n/auth/password" $gx $groupY $groupW $groupH
$gx += $groupW + 28
Draw-EndpointGroup "Users" "/users/:id/points`n/users/:id/history`n/users/:id/purchases`n/users/:id/liked-events`n/users/:id/favorite-services`n/users/:id/email, settings, payment-methods, notifications, delete" $gx $groupY $groupW $groupH
$gx += $groupW + 28
Draw-EndpointGroup "Events" "/events`n/events/participate`n/events/:id/participation`n/events/check-in`n/events/:id/like POST/DELETE" $gx $groupY $groupW $groupH
$gx += $groupW + 28
Draw-EndpointGroup "Points" "/points/services`n/points/services/:id/favorite`n/points/exchange`n/points/purchase" $gx $groupY $groupW $groupH
$gx += $groupW + 28
Draw-EndpointGroup "Support/Notify" "/notifications/:id/read`n/support/tickets GET/POST`n通知詳細、既読、問い合わせ履歴、問い合わせ作成" $gx $groupY $groupW $groupH

$groupY += $groupH + 34
$wideW = 1840
Draw-EndpointGroup "Admin events/stores/services" "/admin/events CRUD + check-in-code`n/admin/stores CRUD`n/admin/services CRUD`n各管理一覧、作成/編集モーダル、削除確認、停止/再開、入力エラー" ($mainX + 34) $groupY $wideW 210
Draw-EndpointGroup "Admin users/support/stats" "/admin/users search/detail/update`n/admin/notifications broadcast/targeted`n/admin/support/tickets list/update`n/admin/stats dashboard`n集計失敗、権限不足、配信結果" ($mainX + 34 + $wideW + 28) $groupY $wideW 210
Draw-EndpointGroup "共通エラーの出口" "401 -> ログイン`n403 -> 権限不足表示`n404 -> 対象なし/一覧へ戻る`n409 -> 重複/競合表示`n429 -> 待機案内`n5xx/network -> 再試行/障害表示" ($mainX + 34 + (($wideW + 28) * 2)) $groupY $wideW 210

Draw-RoundRect ($mainX + 34) ($endpointY + 690) ($mainW - 68) 70 20 "#F8FAFC" "#CBD5E1" 2 $false
Draw-Text "実装方針: まず共通の Loading / Empty / Error / Confirm / ResultModal を作り、各エンドポイントの成功・失敗を同じUIパターンへ流す。これにより画面追加時も遷移漏れを減らせる。" ($mainX + 58) ($endpointY + 708) ($mainW - 116) 34 (New-UiFont 22 ([System.Drawing.FontStyle]::Bold)) "#334155"

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $outputPath



