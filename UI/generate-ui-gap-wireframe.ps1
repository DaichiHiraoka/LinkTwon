Add-Type -AssemblyName System.Drawing

$width = 4200
$height = 2600
$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Join-Path (Get-Location) "UI" }
$outputPath = Join-Path $scriptRoot "linktown-ui-gap-wireframe.png"

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#F6F7FB"))

function Color($hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function SolidBrush($hex) {
  return New-Object System.Drawing.SolidBrush (Color $hex)
}

function Pen($hex, $width = 2) {
  return New-Object System.Drawing.Pen (Color $hex), $width
}

function Font($size, $style = [System.Drawing.FontStyle]::Regular) {
  return New-Object System.Drawing.Font("Yu Gothic", $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function RoundRectPath($x, $y, $w, $h, $r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function DrawRoundRect($x, $y, $w, $h, $r, $fillHex, $strokeHex, $strokeWidth = 2, $dashed = $false) {
  $path = RoundRectPath $x $y $w $h $r
  $brush = SolidBrush $fillHex
  $pen = Pen $strokeHex $strokeWidth
  if ($dashed) {
    $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  }
  $graphics.FillPath($brush, $path)
  $graphics.DrawPath($pen, $path)
  $brush.Dispose()
  $pen.Dispose()
  $path.Dispose()
}

function DrawText($text, $x, $y, $w, $h, $font, $hex = "#111827", $align = "Near") {
  $brush = SolidBrush $hex
  $rect = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::$align
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
  $graphics.DrawString($text, $font, $brush, $rect, $format)
  $brush.Dispose()
  $format.Dispose()
}

function DrawCenteredText($text, $x, $y, $w, $h, $font, $hex = "#111827") {
  $brush = SolidBrush $hex
  $rect = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString($text, $font, $brush, $rect, $format)
  $brush.Dispose()
  $format.Dispose()
}

function DrawArrow($x1, $y1, $x2, $y2, $hex = "#64748B", $dashed = $false) {
  $pen = Pen $hex 4
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  if ($dashed) {
    $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  }
  $cap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(8, 10, $true)
  $pen.CustomEndCap = $cap
  $graphics.DrawLine($pen, $x1, $y1, $x2, $y2)
  $cap.Dispose()
  $pen.Dispose()
}

function DrawMiniLines($x, $y, $w, $count, $hex = "#CBD5E1") {
  for ($i = 0; $i -lt $count; $i++) {
    $lineWidth = [Math]::Round($w * (0.88 - (($i % 3) * 0.13)))
    $pen = Pen $hex 7
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLine($pen, $x, $y + ($i * 24), $x + $lineWidth, $y + ($i * 24))
    $pen.Dispose()
  }
}

function DrawStatusBadge($label, $x, $y, $fill, $text) {
  DrawRoundRect $x $y 96 34 17 $fill $fill 1 $false
  DrawCenteredText $label $x ($y + 1) 96 32 (Font 18 ([System.Drawing.FontStyle]::Bold)) $text
}

function DrawScreen($title, $note, $x, $y, $status = "missing", $kind = "list") {
  $w = 330
  $h = 205
  $fill = "#FFFFFF"
  $stroke = "#F59E0B"
  $dashed = $true
  $badgeFill = "#FEF3C7"
  $badgeText = "#92400E"
  $badge = "不足"

  if ($status -eq "done") {
    $stroke = "#2563EB"
    $dashed = $false
    $badgeFill = "#DBEAFE"
    $badgeText = "#1D4ED8"
    $badge = "既存"
  } elseif ($status -eq "partial") {
    $stroke = "#7C3AED"
    $dashed = $true
    $badgeFill = "#EDE9FE"
    $badgeText = "#5B21B6"
    $badge = "部分"
  }

  DrawRoundRect $x $y $w $h 24 $fill $stroke 4 $dashed
  DrawRoundRect ($x + 18) ($y + 18) ($w - 36) 38 16 "#F8FAFC" "#E2E8F0" 2 $false
  DrawStatusBadge $badge ($x + $w - 118) ($y + 20) $badgeFill $badgeText
  DrawText $title ($x + 28) ($y + 22) 175 34 (Font 22 ([System.Drawing.FontStyle]::Bold)) "#111827"

  if ($kind -eq "form") {
    DrawRoundRect ($x + 32) ($y + 76) ($w - 64) 30 10 "#F1F5F9" "#CBD5E1" 1 $false
    DrawRoundRect ($x + 32) ($y + 118) ($w - 64) 30 10 "#F1F5F9" "#CBD5E1" 1 $false
    DrawRoundRect ($x + 82) ($y + 162) ($w - 164) 28 14 "#111827" "#111827" 1 $false
  } elseif ($kind -eq "scan") {
    $pen = Pen "#CBD5E1" 5
    $graphics.DrawRectangle($pen, $x + 100, $y + 78, 130, 76)
    $graphics.DrawLine($pen, $x + 112, $y + 116, $x + 218, $y + 116)
    $pen.Dispose()
    DrawRoundRect ($x + 72) ($y + 166) 186 24 12 "#F1F5F9" "#CBD5E1" 1 $false
  } elseif ($kind -eq "dashboard") {
    DrawRoundRect ($x + 28) ($y + 76) 126 48 12 "#F1F5F9" "#CBD5E1" 1 $false
    DrawRoundRect ($x + 176) ($y + 76) 126 48 12 "#F1F5F9" "#CBD5E1" 1 $false
    DrawMiniLines ($x + 35) ($y + 146) 250 2
  } elseif ($kind -eq "detail") {
    DrawRoundRect ($x + 28) ($y + 74) 92 70 10 "#F1F5F9" "#CBD5E1" 1 $false
    DrawMiniLines ($x + 140) ($y + 80) 160 3
    DrawRoundRect ($x + 78) ($y + 160) 176 28 14 "#F1F5F9" "#CBD5E1" 1 $false
  } else {
    DrawMiniLines ($x + 32) ($y + 78) ($w - 74) 4
    DrawRoundRect ($x + 32) ($y + 170) 118 24 12 "#F1F5F9" "#CBD5E1" 1 $false
  }

  if ($note) {
    DrawText $note ($x + 28) ($y + $h - 42) ($w - 56) 28 (Font 17) "#64748B"
  }
}

function DrawGapItem($index, $title, $detail, $priority, $x, $y, $w, $h) {
  $colors = @{
    "P1" = @("#FEE2E2", "#B91C1C")
    "P2" = @("#FEF3C7", "#92400E")
    "P3" = @("#E0F2FE", "#0369A1")
  }
  $pair = $colors[$priority]
  DrawRoundRect $x $y $w $h 18 "#FFFFFF" "#E5E7EB" 2 $false
  DrawStatusBadge $priority ($x + 22) ($y + 20) $pair[0] $pair[1]
  DrawText "$index. $title" ($x + 138) ($y + 18) ($w - 162) 34 (Font 25 ([System.Drawing.FontStyle]::Bold)) "#111827"
  DrawText $detail ($x + 30) ($y + 62) ($w - 60) ($h - 72) (Font 21) "#475569"
}

$titleFont = Font 58 ([System.Drawing.FontStyle]::Bold)
$subtitleFont = Font 27
$sectionFont = Font 34 ([System.Drawing.FontStyle]::Bold)
$smallFont = Font 21

DrawText "Link Town UI不足箇所と追加遷移ワイヤーフレーム" 90 58 2500 72 $titleFont "#0F172A"
DrawText "現状UIに無い、またはAPIはあるが画面導線が不足している機能を、1枚で確認できる遷移図として整理。" 94 136 2600 42 $subtitleFont "#475569"

DrawRoundRect 2930 58 1180 105 28 "#FFFFFF" "#E5E7EB" 2 $false
DrawStatusBadge "既存" 2970 92 "#DBEAFE" "#1D4ED8"
DrawText "実装済み画面" 3085 96 190 30 $smallFont "#334155"
DrawStatusBadge "不足" 3290 92 "#FEF3C7" "#92400E"
DrawText "追加が必要" 3405 96 170 30 $smallFont "#334155"
DrawStatusBadge "部分" 3600 92 "#EDE9FE" "#5B21B6"
DrawText "一部だけ存在" 3715 96 200 30 $smallFont "#334155"

DrawRoundRect 90 220 1180 2260 30 "#FFFFFF" "#E2E8F0" 2 $false
DrawText "UIとして足りない部分" 135 260 840 46 $sectionFont "#0F172A"
DrawText "優先度は、現在のAPI/型定義に存在するのにUIで完結できないものを高めにしています。" 138 315 1030 56 (Font 23) "#64748B"

$gaps = @(
  @("新規登録・パスワード再設定", "登録APIとリセットAPIはあるが、ログイン画面からの登録/再設定フォームと完了導線がない。", "P1"),
  @("QR/チェックイン入力", "スキャン画面は完了表示のみ。カメラ起動、コード手入力、読み取り失敗、参加完了までのUIが必要。", "P1"),
  @("通知一覧・詳細・既読", "通知APIと型はあるが、通常画面の導線と一覧/詳細/既読操作が未接続。", "P1"),
  @("問い合わせ/不具合チケット", "サポートAPIはあるが、送信フォーム、履歴一覧、ステータス確認画面がない。", "P1"),
  @("ポイント交換の実行", "サービス一覧は見えるが、交換確認、実行、完了/失敗、履歴への導線が不足。", "P1"),
  @("ポイント購入の実行", "購入画面は静的な確認表示に近く、購入ポイント選択、支払い選択、結果画面が不足。", "P1"),
  @("支払い方法管理", "支払い方法APIはあるが、追加、削除、既定設定、購入時選択のUIがない。", "P2"),
  @("お気に入りサービス実データ", "ウォレットのお気に入りタブはローカル表示で、APIのfavorite/unfavoriteと履歴導線が不足。", "P2"),
  @("管理者ログイン/管理画面", "管理APIは広いが、ログイン、ダッシュボード、イベント/店舗/サービス/ユーザー/問い合わせ管理UIがない。", "P2"),
  @("プロフィール基本情報編集", "アカウントではメール/設定/パスワード中心。氏名、年代、ユーザー種別などの編集導線が不足。", "P3")
)

$gapY = 395
for ($i = 0; $i -lt $gaps.Count; $i++) {
  DrawGapItem ($i + 1) $gaps[$i][0] $gaps[$i][1] $gaps[$i][2] 135 $gapY 1090 174
  $gapY += 194
}

DrawRoundRect 1330 220 2790 2260 30 "#FFFFFF" "#E2E8F0" 2 $false
DrawText "追加すべきUI遷移図ワイヤーフレーム" 1375 260 1180 46 $sectionFont "#0F172A"
DrawText "青は現状の主要UI。オレンジは追加すべき画面。破線矢印は新しく接続すべき導線。" 1378 315 1300 40 (Font 23) "#64748B"

DrawText "認証" 1395 390 300 34 (Font 28 ([System.Drawing.FontStyle]::Bold)) "#334155"
DrawScreen "ログイン" "demoログインあり" 1410 445 "done" "form"
DrawScreen "新規登録" "register API" 1810 445 "missing" "form"
DrawScreen "パスワード再設定" "reset API" 2210 445 "missing" "form"
DrawScreen "ホーム" "ポイント/おすすめ" 2810 445 "done" "dashboard"
DrawArrow 1740 548 1810 548 "#94A3B8" $true
DrawArrow 2140 548 2210 548 "#94A3B8" $true
DrawArrow 2540 548 2810 548 "#64748B" $false
DrawArrow 1740 548 2810 548 "#64748B" $false

DrawText "イベント・参加" 1395 785 400 34 (Font 28 ([System.Drawing.FontStyle]::Bold)) "#334155"
DrawScreen "イベント一覧" "おすすめ/いいね/参加済" 1410 840 "done" "list"
DrawScreen "イベント詳細" "応募/いいね" 1810 840 "done" "detail"
DrawScreen "QR読み取り" "カメラ/手入力" 2210 840 "missing" "scan"
DrawScreen "チェックイン結果" "成功/失敗/重複" 2610 840 "partial" "dashboard"
DrawArrow 1740 942 1810 942 "#64748B" $false
DrawArrow 2140 942 2210 942 "#94A3B8" $true
DrawArrow 2540 942 2610 942 "#94A3B8" $true
DrawArrow 2940 942 2810 650 "#64748B" $false

DrawText "ポイント/ウォレット" 1395 1180 520 34 (Font 28 ([System.Drawing.FontStyle]::Bold)) "#334155"
DrawScreen "ウォレット" "残高/サービス一覧" 1410 1235 "done" "dashboard"
DrawScreen "サービス詳細" "お気に入り/必要pt" 1810 1235 "missing" "detail"
DrawScreen "交換確認" "実行/完了/失敗" 2210 1235 "missing" "form"
DrawScreen "ポイント購入" "現在は静的" 2610 1235 "partial" "form"
DrawScreen "支払い方法管理" "追加/削除/既定" 3010 1235 "missing" "list"
DrawScreen "購入結果" "paid/failed/pending" 3410 1235 "missing" "dashboard"
DrawArrow 1740 1338 1810 1338 "#94A3B8" $true
DrawArrow 2140 1338 2210 1338 "#94A3B8" $true
DrawArrow 1740 1338 2610 1338 "#64748B" $false
DrawArrow 2940 1338 3010 1338 "#94A3B8" $true
DrawArrow 3340 1338 3410 1338 "#94A3B8" $true

DrawText "アカウント/連絡" 1395 1575 520 34 (Font 28 ([System.Drawing.FontStyle]::Bold)) "#334155"
DrawScreen "アカウント" "設定/パスワード" 1410 1630 "done" "form"
DrawScreen "プロフィール編集" "氏名/年代/種別" 1810 1630 "missing" "form"
DrawScreen "通知一覧" "詳細/既読" 2210 1630 "missing" "list"
DrawScreen "問い合わせ" "チケット作成" 2610 1630 "missing" "form"
DrawScreen "問い合わせ履歴" "ステータス確認" 3010 1630 "missing" "list"
DrawArrow 1740 1732 1810 1732 "#94A3B8" $true
DrawArrow 1740 1732 2210 1732 "#94A3B8" $true
DrawArrow 1740 1732 2610 1732 "#94A3B8" $true
DrawArrow 2940 1732 3010 1732 "#94A3B8" $true

DrawText "管理者" 1395 1970 300 34 (Font 28 ([System.Drawing.FontStyle]::Bold)) "#334155"
DrawScreen "管理者ログイン" "admin/login" 1410 2025 "missing" "form"
DrawScreen "管理ダッシュボード" "stats" 1810 2025 "missing" "dashboard"
DrawScreen "イベント管理" "作成/停止/削除/QR" 2210 2025 "missing" "list"
DrawScreen "店舗/サービス管理" "交換メニュー管理" 2610 2025 "missing" "list"
DrawScreen "ユーザー/問い合わせ管理" "検索/対応/通知" 3010 2025 "missing" "list"
DrawArrow 1740 2128 1810 2128 "#94A3B8" $true
DrawArrow 2140 2128 2210 2128 "#94A3B8" $true
DrawArrow 2540 2128 2610 2128 "#94A3B8" $true
DrawArrow 2940 2128 3010 2128 "#94A3B8" $true

DrawRoundRect 1375 2340 2700 88 24 "#F8FAFC" "#E2E8F0" 2 $false
DrawText "読み方: 既存UIは残しつつ、オレンジの画面を下部ナビ・ヘッダー・各詳細画面から接続する。P1はユーザーがAPI機能をUIだけで完結できないため優先。" 1410 2362 2630 42 (Font 24) "#334155"

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $outputPath

