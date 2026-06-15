Add-Type -AssemblyName System.Drawing

$width = 5600
$height = 3600
$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Join-Path (Get-Location) "UI" }
$outputPath = Join-Path $scriptRoot "linktown-partner-portal-state-transition-map.png"

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#F6F8FC"))

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

function Draw-Badge($label, $x, $y, $fillHex, $textHex, $w = 112) {
  Draw-RoundRect $x $y $w 34 17 $fillHex $fillHex 1 $false
  Draw-CenteredText $label $x ($y + 1) $w 32 (New-UiFont 17 ([System.Drawing.FontStyle]::Bold)) $textHex
}

function Get-Style($kind) {
  switch ($kind) {
    "screen" { return @{ Label = "画面"; Fill = "#FFFFFF"; Stroke = "#2563EB"; BadgeFill = "#DBEAFE"; BadgeText = "#1D4ED8"; Dashed = $false } }
    "state" { return @{ Label = "状態"; Fill = "#FFFFFF"; Stroke = "#0891B2"; BadgeFill = "#CFFAFE"; BadgeText = "#155E75"; Dashed = $true } }
    "action" { return @{ Label = "操作"; Fill = "#FFFFFF"; Stroke = "#7C3AED"; BadgeFill = "#EDE9FE"; BadgeText = "#5B21B6"; Dashed = $false } }
    "success" { return @{ Label = "成功"; Fill = "#FFFFFF"; Stroke = "#16A34A"; BadgeFill = "#DCFCE7"; BadgeText = "#166534"; Dashed = $false } }
    "error" { return @{ Label = "異常"; Fill = "#FFFFFF"; Stroke = "#DC2626"; BadgeFill = "#FEE2E2"; BadgeText = "#B91C1C"; Dashed = $true } }
    "external" { return @{ Label = "外部"; Fill = "#FFFFFF"; Stroke = "#F59E0B"; BadgeFill = "#FEF3C7"; BadgeText = "#92400E"; Dashed = $true } }
    default { return @{ Label = "状態"; Fill = "#FFFFFF"; Stroke = "#64748B"; BadgeFill = "#E2E8F0"; BadgeText = "#334155"; Dashed = $false } }
  }
}

function Draw-Card($title, $kind, $endpoint, $note, $x, $y, $w = 430, $h = 170) {
  $style = Get-Style $kind
  Draw-RoundRect $x $y $w $h 18 $style.Fill $style.Stroke 3 $style.Dashed
  Draw-Badge $style.Label ($x + $w - 132) ($y + 16) $style.BadgeFill $style.BadgeText
  Draw-Text $title ($x + 18) ($y + 16) ($w - 160) 36 (New-UiFont 22 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
  Draw-Text $endpoint ($x + 18) ($y + 58) ($w - 36) 26 (New-UiFont 16 ([System.Drawing.FontStyle]::Bold)) "#2563EB"
  Draw-Text $note ($x + 18) ($y + 88) ($w - 36) ($h - 98) (New-UiFont 17) "#475569"
  return @{ X = $x; Y = $y; W = $w; H = $h }
}

function Draw-Lane($title, $subtitle, $x, $y, $w, $h, $accent) {
  Draw-RoundRect $x $y $w $h 26 "#FFFFFF" "#E2E8F0" 2 $false
  Draw-RoundRect ($x + 28) ($y + 28) 16 72 8 $accent $accent 1 $false
  Draw-Text $title ($x + 62) ($y + 24) ($w - 100) 42 (New-UiFont 30 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
  Draw-Text $subtitle ($x + 64) ($y + 66) ($w - 110) 32 (New-UiFont 19) "#64748B"
}

function Draw-List($title, $items, $x, $y, $w, $h, $accent = "#2563EB") {
  Draw-RoundRect $x $y $w $h 22 "#FFFFFF" "#E2E8F0" 2 $false
  Draw-Text $title ($x + 28) ($y + 24) ($w - 56) 36 (New-UiFont 26 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
  $itemY = $y + 76
  foreach ($item in $items) {
    Draw-RoundRect ($x + 30) ($itemY + 8) 12 12 6 $accent $accent 1 $false
    Draw-Text $item ($x + 54) $itemY ($w - 78) 48 (New-UiFont 18) "#475569"
    $itemY += 52
  }
}

function Draw-Endpoint($title, $body, $x, $y, $w, $h) {
  Draw-RoundRect $x $y $w $h 16 "#F8FAFC" "#CBD5E1" 2 $false
  Draw-Text $title ($x + 18) ($y + 14) ($w - 36) 30 (New-UiFont 21 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
  Draw-Text $body ($x + 18) ($y + 48) ($w - 36) ($h - 56) (New-UiFont 17) "#475569"
}

$titleFont = New-UiFont 48 ([System.Drawing.FontStyle]::Bold)
$subtitleFont = New-UiFont 24
Draw-Text "LinkTwon イベント主催者・商店側アプリ 状態遷移図" 84 54 3800 68 $titleFont "#0F172A"
Draw-Text "利用者が提示する本人確認QRを、イベント主催者または商店スタッフが読み取る専用ポータルの状態、操作、異常系を整理。" 90 128 4800 38 $subtitleFont "#475569"

Draw-RoundRect 4050 48 1380 124 28 "#FFFFFF" "#E2E8F0" 2 $false
Draw-Badge "画面" 4092 88 "#DBEAFE" "#1D4ED8" 96
Draw-Badge "操作" 4238 88 "#EDE9FE" "#5B21B6" 96
Draw-Badge "成功" 4384 88 "#DCFCE7" "#166534" 96
Draw-Badge "異常" 4530 88 "#FEE2E2" "#B91C1C" 96
Draw-Badge "外部" 4676 88 "#FEF3C7" "#92400E" 96
Draw-Badge "状態" 4822 88 "#CFFAFE" "#155E75" 96
Draw-Text "実線: 通常遷移 / 点線: 異常・代替遷移" 4972 92 420 30 (New-UiFont 18) "#334155"

Draw-List "共通の前提" @(
  "主催者アプリは既定ポート 5181、商店アプリは 5182 の個別アプリ。",
  "アクセスコードは localStorage に保存し、起動時に自動で bootstrap を試行。",
  "言語切替は ja/en を切り替え、payload がある場合は再取得する。",
  "QRは利用者提示型。読み取り側はJWTやパスワードを受け取らない。",
  "カメラ不可時はQR内容の手入力フォームにフォールバックする。"
) 84 230 1420 380 "#2563EB"

Draw-List "共通異常系" @(
  "401: アクセスコード不正。payload を破棄しログインフォームにエラー表示。",
  "404: 対象イベント/商品なし。対象カード内にエラー表示。",
  "409: 同一nonceの重複利用。二重受付・二重交換を防止。",
  "QR不正/期限切れ/必須項目不足: カード内エラーとして表示。",
  "ネットワーク/API失敗: 既存画面を維持しエラーを表示、再送信可能。"
) 1560 230 1420 380 "#DC2626"

Draw-List "状態管理単位" @(
  "payload: アカウント情報とイベント/商品一覧。",
  "error: アクセスコード検証やbootstrapの全体エラー。",
  "resultById: イベントIDまたは商品ID単位の成功結果。",
  "errorById: イベントIDまたは商品ID単位の読取/送信エラー。",
  "locale/code: localStorage へ保存し、再訪時に復元。"
) 3036 230 1420 380 "#0891B2"

$laneX = 84
$laneW = 2660
$eventY = 690
$laneH = 1160
Draw-Lane "イベント主催者アプリ" "アクセスコードで担当イベントを取得し、参加者QRを読み取って受付・付与ポイントを確定する。" $laneX $eventY $laneW $laneH "#2563EB"

$e1 = Draw-Card "初期表示/自動読込" "state" "render(); loadPortal()" "保存済み code/locale を読み込み、起動直後に /api/bootstrap を呼ぶ。" 140 830
$e2 = Draw-Card "アクセスコード入力" "screen" "GET /api/bootstrap" "主催者アクセスコードを入力。成功時は payload に account/events を保存。" 650 830
$e3 = Draw-Card "コード不正/取得失敗" "error" "401/network" "payload は null。フォーム下にエラーを表示し、再入力できる。" 1160 830
$e4 = Draw-Card "主催者情報表示" "screen" "payload.account" "主催者名、連絡先を表示。言語切替時は再度 bootstrap を実行。" 1670 830
$e5 = Draw-Card "担当イベント一覧" "screen" "payload.events[]" "イベント名、日時、場所、付与ポイント、説明、活動内容、注意事項を表示。" 2180 830

$e6 = Draw-Card "参加者QR読取" "action" "BarcodeDetector" "カメラで利用者アプリの本人確認QRを読み取る。閉じる操作で中断。" 390 1128
$e7 = Draw-Card "手入力フォールバック" "screen" "textarea" "カメラ未対応、権限拒否、読取失敗時にQR内容を手入力できる。" 900 1128
$e8 = Draw-Card "受付API送信" "action" "POST /api/event/check-ins" "code、event_id、user_qr_payload、locale を送信する。" 1410 1128
$e9 = Draw-Card "受付完了" "success" "201 Created" "参加者名、user_id、付与ポイント、イベント名を結果表示する。" 1920 1128
$e10 = Draw-Card "受付失敗" "error" "400/401/404/409" "QR不正、期限切れ、コード不正、対象なし、重複受付をカード内に表示。" 390 1426

Draw-Arrow ($e1.X + $e1.W) ($e1.Y + 85) $e2.X ($e2.Y + 85)
Draw-Arrow ($e2.X + $e2.W) ($e2.Y + 70) $e4.X ($e4.Y + 70)
Draw-Arrow ($e2.X + $e2.W) ($e2.Y + 116) $e3.X ($e3.Y + 116) "#DC2626" $true
Draw-Arrow ($e4.X + $e4.W) ($e4.Y + 85) $e5.X ($e5.Y + 85)
Draw-Arrow ($e5.X + 215) ($e5.Y + $e5.H) ($e6.X + 215) $e6.Y
Draw-Arrow ($e6.X + $e6.W) ($e6.Y + 70) $e8.X ($e8.Y + 70)
Draw-Arrow ($e6.X + $e6.W) ($e6.Y + 118) $e7.X ($e7.Y + 118) "#DC2626" $true
Draw-Arrow ($e7.X + $e7.W) ($e7.Y + 88) $e8.X ($e8.Y + 88)
Draw-Arrow ($e8.X + $e8.W) ($e8.Y + 70) $e9.X ($e9.Y + 70)
Draw-Arrow ($e8.X + 120) ($e8.Y + $e8.H) ($e10.X + 250) $e10.Y "#DC2626" $true
Draw-Arrow ($e10.X + 215) ($e10.Y) ($e6.X + 215) ($e6.Y + $e6.H) "#64748B" $true

$storeX = 2856
$storeY = 690
Draw-Lane "商店アプリ" "アクセスコードで店舗と商品を取得し、利用者QRを読み取ってポイント交換を確定する。" $storeX $storeY $laneW $laneH "#16A34A"

$s1 = Draw-Card "初期表示/自動読込" "state" "render(); loadPortal()" "保存済み code/locale を読み込み、起動直後に /api/bootstrap を呼ぶ。" 2912 830
$s2 = Draw-Card "アクセスコード入力" "screen" "GET /api/bootstrap" "商店アクセスコードを入力。成功時は payload に account/services を保存。" 3422 830
$s3 = Draw-Card "コード不正/取得失敗" "error" "401/network" "payload は null。フォーム下にエラーを表示し、再入力できる。" 3932 830
$s4 = Draw-Card "店舗情報/地図導線" "screen" "payload.account" "店舗名、住所、連絡先、Google Map 検索リンクを表示する。" 4442 830
$s5 = Draw-Card "交換商品一覧" "screen" "payload.services[]" "商品名、カテゴリ、必要ポイント、説明を表示する。" 4952 830

$s6 = Draw-Card "利用者QR読取" "action" "BarcodeDetector" "カメラで利用者アプリの本人確認QRを読み取る。閉じる操作で中断。" 3162 1128
$s7 = Draw-Card "手入力フォールバック" "screen" "textarea" "カメラ未対応、権限拒否、読取失敗時にQR内容を手入力できる。" 3672 1128
$s8 = Draw-Card "交換API送信" "action" "POST /api/store/exchanges" "code、service_id、user_qr_payload、locale を送信する。" 4182 1128
$s9 = Draw-Card "交換完了" "success" "201 Created" "利用者名、user_id、利用ポイント、商品名を結果表示する。" 4692 1128
$s10 = Draw-Card "交換失敗" "error" "400/401/404/409" "QR不正、期限切れ、コード不正、対象なし、重複交換をカード内に表示。" 3162 1426

Draw-Arrow ($s1.X + $s1.W) ($s1.Y + 85) $s2.X ($s2.Y + 85)
Draw-Arrow ($s2.X + $s2.W) ($s2.Y + 70) $s4.X ($s4.Y + 70)
Draw-Arrow ($s2.X + $s2.W) ($s2.Y + 116) $s3.X ($s3.Y + 116) "#DC2626" $true
Draw-Arrow ($s4.X + $s4.W) ($s4.Y + 85) $s5.X ($s5.Y + 85)
Draw-Arrow ($s5.X + 215) ($s5.Y + $s5.H) ($s6.X + 215) $s6.Y
Draw-Arrow ($s6.X + $s6.W) ($s6.Y + 70) $s8.X ($s8.Y + 70)
Draw-Arrow ($s6.X + $s6.W) ($s6.Y + 118) $s7.X ($s7.Y + 118) "#DC2626" $true
Draw-Arrow ($s7.X + $s7.W) ($s7.Y + 88) $s8.X ($s8.Y + 88)
Draw-Arrow ($s8.X + $s8.W) ($s8.Y + 70) $s9.X ($s9.Y + 70)
Draw-Arrow ($s8.X + 120) ($s8.Y + $s8.H) ($s10.X + 250) $s10.Y "#DC2626" $true
Draw-Arrow ($s10.X + 215) ($s10.Y) ($s6.X + 215) ($s6.Y + $s6.H) "#64748B" $true

Draw-RoundRect 84 1930 5432 860 26 "#FFFFFF" "#E2E8F0" 2 $false
Draw-Text "API・データ状態カバレッジ" 124 1972 1200 42 (New-UiFont 30 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
Draw-Text "画面遷移ではない状態も、カード内エラー・結果表示・再取得として扱う。利用者提示QR方式のため、主催者/商店側はQR生成を行わない。" 126 2014 5000 32 (New-UiFont 19) "#64748B"

Draw-Endpoint "GET /api/bootstrap" "入力: code, locale`n成功: role, account, events/services, not_translated_fields`n失敗: 401 invalid access code / network error" 140 2088 1020 260
Draw-Endpoint "POST /api/event/check-ins" "入力: code, event_id, user_qr_payload, locale`n成功: user, event_id, event_name, granted_points`n失敗: 401/404/409/QR parse errors" 1210 2088 1020 260
Draw-Endpoint "POST /api/store/exchanges" "入力: code, service_id, user_qr_payload, locale`n成功: user, service_id, service_name, used_points`n失敗: 401/404/409/QR parse errors" 2280 2088 1020 260
Draw-Endpoint "QRペイロード検証" "linktown://user-present?... またはJSON`n必須: type=user-present, user_id, nonce, expires_at`n期限切れ、形式不正、必須不足は拒否" 3350 2088 1020 260
Draw-Endpoint "翻訳/原文保持" "イベント名・説明・商品名・説明は翻訳キャッシュを参照`n住所、店舗名、日時、ポイント、map_query は原文保持" 4420 2088 1020 260

Draw-Endpoint "言語切替" "toggle-locale -> locale保存 -> payloadがある場合 loadPortal()再実行`n固定UI文言は埋め込み辞書、可変文言はキャッシュを参照" 140 2392 1290 250
Draw-Endpoint "カメラ読取" "BarcodeDetector + getUserMedia`n成功: rawValueを送信`n未対応/拒否/中断: errorByIdに表示し手入力へ" 1480 2392 1290 250
Draw-Endpoint "重複防止" "processedScans Set`nevent:<event_id>:<user_id>:<nonce>`nstore:<service_id>:<user_id>:<nonce>`n409で二重処理を拒否" 2820 2392 1290 250
Draw-Endpoint "結果表示単位" "resultById/errorById はイベントIDまたは商品IDごとに保持`n複数カードがあっても各カード内で結果・エラーを独立表示" 4160 2392 1290 250

Draw-RoundRect 84 2880 5432 520 26 "#F8FAFC" "#CBD5E1" 2 $false
Draw-Text "実装・テスト時の確認ポイント" 124 2920 1280 40 (New-UiFont 30 ([System.Drawing.FontStyle]::Bold)) "#0F172A"
Draw-Text "1. 正常系: event-demo/store-demo で bootstrap 成功、対象カード表示、QR手入力で201結果表示。" 150 2990 5100 34 (New-UiFont 21) "#334155"
Draw-Text "2. 異常系: 空QR、形式不正、期限切れ、同一nonce再送、無効code、対象ID不一致をカード内エラーで確認。" 150 3042 5100 34 (New-UiFont 21) "#334155"
Draw-Text "3. 代替系: BarcodeDetector未対応またはカメラ拒否時、手入力フォームで同じAPIへ送信できることを確認。" 150 3094 5100 34 (New-UiFont 21) "#334155"
Draw-Text "4. 表示系: 言語切替で固定UIと可変コンテンツが切り替わり、住所・店舗名・日時・ポイント・map_query は原文保持。" 150 3146 5100 34 (New-UiFont 21) "#334155"
Draw-Text "5. セキュリティ: QRにJWT/パスワード/決済情報を含めず、読み取り側は期限・nonce・対象権限を必ず検証する。" 150 3198 5100 34 (New-UiFont 21) "#334155"
Draw-Text "生成元: UI/generate-partner-portal-state-transition-map.ps1 / 出力: UI/linktown-partner-portal-state-transition-map.png" 150 3288 5100 30 (New-UiFont 18) "#64748B"

$graphics.Flush()
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Host $outputPath

