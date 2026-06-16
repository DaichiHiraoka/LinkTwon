Add-Type -AssemblyName System.Drawing

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Join-Path (Get-Location) "UI" }

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

function Draw-RoundRect($graphics, $x, $y, $w, $h, $r, $fillHex, $strokeHex, $strokeWidth = 2, $dashed = $false) {
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

function Draw-Text($graphics, $text, $x, $y, $w, $h, $font, $hex = "#111827", $align = "Near", $lineAlign = "Near") {
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

function Draw-Line($graphics, $x1, $y1, $x2, $y2, $hex = "#7F1D1D", $width = 4, $dashed = $false) {
  $pen = New-Pen $hex $width
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  if ($dashed) {
    $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  }
  $graphics.DrawLine($pen, $x1, $y1, $x2, $y2)
  $pen.Dispose()
}

function Draw-ColorChip($graphics, $label, $hex, $x, $y, $w = 430) {
  Draw-RoundRect $graphics $x $y $w 54 14 "#FFFFFF" "#FCA5A5" 2 $false
  Draw-RoundRect $graphics ($x + 14) ($y + 12) 44 30 8 $hex $hex 1 $false
  Draw-Text $graphics $label ($x + 70) ($y + 8) 210 22 (New-UiFont 16 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics $hex ($x + 70) ($y + 29) 160 20 (New-UiFont 14) "#7F1D1D"
}

function Draw-Annotation($graphics, $text, $x, $y, $w = 300) {
  Draw-RoundRect $graphics $x $y $w 42 12 "#FFF7ED" "#F97316" 2 $false
  Draw-Text $graphics $text ($x + 12) ($y + 9) ($w - 24) 22 (New-UiFont 14 ([System.Drawing.FontStyle]::Bold)) "#9A3412"
}

function Draw-PhoneFrame($graphics, $x, $y, $w, $h, $bgHex) {
  Draw-RoundRect $graphics $x $y $w $h 42 "#2B0B0B" "#450A0A" 6 $false
  Draw-RoundRect $graphics ($x + 24) ($y + 28) ($w - 48) ($h - 56) 28 $bgHex "#7F1D1D" 2 $false
}

function Draw-WireButton($graphics, $label, $x, $y, $w, $h, $fill, $stroke, $text = "#FFFFFF") {
  Draw-RoundRect $graphics $x $y $w $h 16 $fill $stroke 2 $false
  Draw-Text $graphics $label $x ($y + 2) $w ($h - 4) (New-UiFont 18 ([System.Drawing.FontStyle]::Bold)) $text "Center" "Center"
}

function Draw-Input($graphics, $label, $x, $y, $w, $h, $surface, $stroke, $textHex) {
  Draw-Text $graphics $label $x ($y - 32) $w 24 (New-UiFont 16 ([System.Drawing.FontStyle]::Bold)) $textHex
  Draw-RoundRect $graphics $x $y $w $h 14 $surface $stroke 2 $false
}

function Draw-Header($graphics, $title, $x, $y, $w, $fill, $textHex, $buttonFill, $buttonText) {
  Draw-RoundRect $graphics $x $y $w 118 24 $fill $fill 1 $false
  Draw-Text $graphics "LinkTwon" ($x + 28) ($y + 22) 220 24 (New-UiFont 17 ([System.Drawing.FontStyle]::Bold)) "#FECACA"
  Draw-Text $graphics $title ($x + 28) ($y + 50) ($w - 170) 42 (New-UiFont 26 ([System.Drawing.FontStyle]::Bold)) $textHex
  Draw-WireButton $graphics "EN" ($x + $w - 96) ($y + 34) 62 46 $buttonFill $buttonFill $buttonText
}

function Draw-EventWireframe($outputPath) {
  $width = 3000
  $height = 2200
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear((ColorFromHex "#FFF1F2"))

  $palette = @{
    PageBg = "#FFF1F2"
    AppBg = "#450A0A"
    Header = "#7F1D1D"
    Surface = "#FEE2E2"
    Panel = "#FFFFFF"
    Primary = "#DC2626"
    Secondary = "#FCA5A5"
    Border = "#B91C1C"
    Text = "#1F2937"
    Success = "#16A34A"
    Error = "#991B1B"
  }

  Draw-Text $graphics "イベント主催者向けアプリ ワイヤーフレーム" 84 58 1600 60 (New-UiFont 42 ([System.Drawing.FontStyle]::Bold)) "#450A0A"
  Draw-Text $graphics "住民用アプリと区別するため、背景・ヘッダー・操作ボタンを赤基調で統一。各パーツにカラーコードを明記。" 88 124 2100 36 (New-UiFont 20) "#7F1D1D"

  Draw-PhoneFrame $graphics 120 240 940 1780 $palette.AppBg
  $sx = 144
  $sy = 268
  $sw = 892
  Draw-Header $graphics "イベント主催者ポータル" $sx $sy $sw $palette.Header "#FFFFFF" $palette.Secondary "#450A0A"
  Draw-Annotation $graphics "Header #7F1D1D" 820 292 185

  Draw-RoundRect $graphics ($sx + 28) ($sy + 150) ($sw - 56) 220 24 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "主催者アクセスコード" ($sx + 56) ($sy + 180) 300 30 (New-UiFont 18 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-Input $graphics "" ($sx + 56) ($sy + 250) 500 64 $palette.Panel $palette.Border $palette.Text
  Draw-WireButton $graphics "イベントを表示" ($sx + 580) ($sy + 250) 270 64 $palette.Primary $palette.Primary
  Draw-Annotation $graphics "Form surface #FEE2E2" 700 456 245
  Draw-Annotation $graphics "Primary #DC2626" 700 536 210

  Draw-RoundRect $graphics ($sx + 28) ($sy + 405) ($sw - 56) 120 22 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "主催者" ($sx + 56) ($sy + 430) 160 26 (New-UiFont 16 ([System.Drawing.FontStyle]::Bold)) "#7F1D1D"
  Draw-Text $graphics "〇〇地域イベント実行委員会" ($sx + 56) ($sy + 462) 430 32 (New-UiFont 22 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-Text $graphics "連絡先  organizer@example.com" ($sx + 520) ($sy + 462) 330 30 (New-UiFont 16) "#7F1D1D"

  Draw-RoundRect $graphics ($sx + 28) ($sy + 565) ($sw - 56) 760 24 $palette.Panel $palette.Border 3 $false
  Draw-Text $graphics "担当イベントカード" ($sx + 56) ($sy + 596) 360 36 (New-UiFont 24 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-RoundRect $graphics ($sx + 58) ($sy + 646) 168 42 21 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "参加者QR読取" ($sx + 76) ($sy + 655) 132 22 (New-UiFont 15 ([System.Drawing.FontStyle]::Bold)) "#991B1B"
  Draw-Text $graphics "商店街清掃ボランティア" ($sx + 56) ($sy + 708) 460 34 (New-UiFont 25 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-Text $graphics "開催日時  2026/06/22 10:00" ($sx + 56) ($sy + 766) 380 26 (New-UiFont 17) "#7F1D1D"
  Draw-Text $graphics "集合場所  〇〇商店街中央広場" ($sx + 56) ($sy + 806) 410 26 (New-UiFont 17) "#7F1D1D"
  Draw-Text $graphics "付与ポイント  100pt" ($sx + 520) ($sy + 766) 260 26 (New-UiFont 17 ([System.Drawing.FontStyle]::Bold)) "#991B1B"
  Draw-RoundRect $graphics ($sx + 56) ($sy + 866) 780 150 18 "#FFF7F7" $palette.Secondary 2 $false
  Draw-Text $graphics "説明 / 活動内容 / 注意事項" ($sx + 82) ($sy + 892) 360 28 (New-UiFont 18 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-Line $graphics ($sx + 82) ($sy + 940) ($sx + 760) ($sy + 940) "#FCA5A5" 5 $false
  Draw-Line $graphics ($sx + 82) ($sy + 980) ($sx + 650) ($sy + 980) "#FCA5A5" 5 $false

  Draw-RoundRect $graphics ($sx + 56) ($sy + 1058) 780 232 20 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "参加者QR読取" ($sx + 82) ($sy + 1082) 240 30 (New-UiFont 20 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-WireButton $graphics "カメラで読む" ($sx + 82) ($sy + 1134) 220 56 "#7F1D1D" "#7F1D1D"
  Draw-RoundRect $graphics ($sx + 326) ($sy + 1134) 300 56 14 $palette.Panel $palette.Border 2 $false
  Draw-Text $graphics "QR内容を手入力" ($sx + 344) ($sy + 1150) 220 24 (New-UiFont 16) "#7F1D1D"
  Draw-WireButton $graphics "受付する" ($sx + 650) ($sy + 1134) 168 56 $palette.Primary $palette.Primary
  Draw-RoundRect $graphics ($sx + 82) ($sy + 1216) 320 48 14 "#DCFCE7" "#16A34A" 2 $false
  Draw-Text $graphics "受付完了: 山田太郎 / 100pt" ($sx + 100) ($sy + 1229) 280 22 (New-UiFont 15 ([System.Drawing.FontStyle]::Bold)) "#166534"

  Draw-Annotation $graphics "Card #FFFFFF / Border #B91C1C" 710 840 275
  Draw-Annotation $graphics "Scanner #FEE2E2" 735 1280 210
  Draw-Annotation $graphics "Success #16A34A" 515 1492 205

  Draw-RoundRect $graphics 1160 240 760 850 28 "#FFFFFF" "#FCA5A5" 3 $false
  Draw-Text $graphics "イベント主催者アプリの主要パーツ" 1200 282 620 42 (New-UiFont 28 ([System.Drawing.FontStyle]::Bold)) "#450A0A"
  Draw-Text $graphics "画面内に赤系の役割色を固定し、住民用アプリの白基調UIと視覚的に切り離す。" 1202 332 650 60 (New-UiFont 18) "#7F1D1D"
  $chipY = 430
  Draw-ColorChip $graphics "ページ背景" $palette.PageBg 1200 $chipY
  Draw-ColorChip $graphics "アプリ背景" $palette.AppBg 1200 ($chipY + 68)
  Draw-ColorChip $graphics "ヘッダー" $palette.Header 1200 ($chipY + 136)
  Draw-ColorChip $graphics "フォーム/読取面" $palette.Surface 1200 ($chipY + 204)
  Draw-ColorChip $graphics "カード面" $palette.Panel 1200 ($chipY + 272)
  Draw-ColorChip $graphics "主要ボタン" $palette.Primary 1200 ($chipY + 340)
  Draw-ColorChip $graphics "補助/入力線" $palette.Secondary 1200 ($chipY + 408)
  Draw-ColorChip $graphics "エラー" $palette.Error 1200 ($chipY + 476)

  Draw-RoundRect $graphics 1160 1160 760 690 28 "#FFFFFF" "#FCA5A5" 3 $false
  Draw-Text $graphics "状態別ワイヤー" 1200 1202 500 40 (New-UiFont 28 ([System.Drawing.FontStyle]::Bold)) "#450A0A"
  Draw-Text $graphics "1. 初期表示: 保存済みアクセスコードで自動読込" 1225 1274 630 32 (New-UiFont 19) "#1F2937"
  Draw-Text $graphics "2. コード不正: フォーム下に赤エラー表示" 1225 1326 630 32 (New-UiFont 19) "#1F2937"
  Draw-Text $graphics "3. 担当イベント: イベント単位で読取パネルを表示" 1225 1378 630 32 (New-UiFont 19) "#1F2937"
  Draw-Text $graphics "4. カメラ不可: 手入力欄へ誘導" 1225 1430 630 32 (New-UiFont 19) "#1F2937"
  Draw-Text $graphics "5. 受付成功/失敗: カード内に結果を固定表示" 1225 1482 630 32 (New-UiFont 19) "#1F2937"
  Draw-RoundRect $graphics 1220 1560 620 160 22 "#FEE2E2" "#B91C1C" 3 $false
  Draw-Text $graphics "エラー表示例 #991B1B" 1250 1590 300 28 (New-UiFont 20 ([System.Drawing.FontStyle]::Bold)) "#991B1B"
  Draw-Text $graphics "QR期限切れ / 形式不正 / 重複受付 / 対象イベントなし" 1250 1634 520 54 (New-UiFont 17) "#7F1D1D"

  Draw-RoundRect $graphics 2020 240 820 1610 28 "#FFFFFF" "#FCA5A5" 3 $false
  Draw-Text $graphics "実装対象画面" 2060 282 500 42 (New-UiFont 28 ([System.Drawing.FontStyle]::Bold)) "#450A0A"
  Draw-Text $graphics "イベント主催者側は、住民用の下部ナビ構成ではなく、業務用の縦長カード一覧として扱う。" 2062 332 700 72 (New-UiFont 18) "#7F1D1D"
  Draw-RoundRect $graphics 2085 448 700 220 20 "#FEE2E2" "#B91C1C" 2 $false
  Draw-Text $graphics "A. アクセスコード入力" 2120 486 420 30 (New-UiFont 21 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "codeをGET /api/bootstrapへ送信。401は同画面で再入力。" 2120 530 560 56 (New-UiFont 17) "#7F1D1D"
  Draw-RoundRect $graphics 2085 710 700 260 20 "#FEE2E2" "#B91C1C" 2 $false
  Draw-Text $graphics "B. イベント一覧" 2120 748 420 30 (New-UiFont 21 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "イベント名、開催日時、集合場所、付与ポイント、説明、活動内容、注意事項。" 2120 792 560 82 (New-UiFont 17) "#7F1D1D"
  Draw-RoundRect $graphics 2085 1012 700 290 20 "#FEE2E2" "#B91C1C" 2 $false
  Draw-Text $graphics "C. QR読取パネル" 2120 1050 420 30 (New-UiFont 21 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "BarcodeDetectorで読取。未対応時はtextareaでuser_qr_payloadを送信。" 2120 1094 560 82 (New-UiFont 17) "#7F1D1D"
  Draw-RoundRect $graphics 2085 1345 700 260 20 "#FEE2E2" "#B91C1C" 2 $false
  Draw-Text $graphics "D. 受付結果" 2120 1383 420 30 (New-UiFont 21 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "成功は利用者名と付与pt、失敗は理由を同じカード内に表示。" 2120 1427 560 70 (New-UiFont 17) "#7F1D1D"

  $graphics.Flush()
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Draw-StoreWireframe($outputPath) {
  $width = 3000
  $height = 2200
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear((ColorFromHex "#FFF1F2"))

  $palette = @{
    PageBg = "#FFF1F2"
    AppBg = "#4C0519"
    Header = "#9F1239"
    Surface = "#FFE4E6"
    Panel = "#FFF7F7"
    Primary = "#E11D48"
    Secondary = "#FDA4AF"
    Border = "#BE123C"
    Text = "#1F2937"
    Success = "#16A34A"
    Error = "#9F1239"
  }

  Draw-Text $graphics "商店向けアプリ ワイヤーフレーム" 84 58 1500 60 (New-UiFont 42 ([System.Drawing.FontStyle]::Bold)) "#4C0519"
  Draw-Text $graphics "交換業務用の画面として、ローズ/赤基調の配色に統一。店舗情報、商品、QR読取、交換結果を1画面で扱う。" 88 124 2200 36 (New-UiFont 20) "#9F1239"

  Draw-PhoneFrame $graphics 120 240 940 1780 $palette.AppBg
  $sx = 144
  $sy = 268
  $sw = 892
  Draw-Header $graphics "商店ポータル" $sx $sy $sw $palette.Header "#FFFFFF" $palette.Secondary "#4C0519"
  Draw-Annotation $graphics "Header #9F1239" 820 292 185

  Draw-RoundRect $graphics ($sx + 28) ($sy + 150) ($sw - 56) 220 24 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "商店アクセスコード" ($sx + 56) ($sy + 180) 300 30 (New-UiFont 18 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-Input $graphics "" ($sx + 56) ($sy + 250) 500 64 $palette.Panel $palette.Border $palette.Text
  Draw-WireButton $graphics "商品を表示" ($sx + 580) ($sy + 250) 270 64 $palette.Primary $palette.Primary
  Draw-Annotation $graphics "Form surface #FFE4E6" 700 456 245
  Draw-Annotation $graphics "Primary #E11D48" 700 536 210

  Draw-RoundRect $graphics ($sx + 28) ($sy + 405) ($sw - 56) 168 22 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "店舗情報" ($sx + 56) ($sy + 430) 160 26 (New-UiFont 16 ([System.Drawing.FontStyle]::Bold)) "#9F1239"
  Draw-Text $graphics "まちのパン屋" ($sx + 56) ($sy + 462) 320 34 (New-UiFont 25 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-Text $graphics "東京都千代田区有楽町1丁目" ($sx + 56) ($sy + 510) 420 26 (New-UiFont 16) "#9F1239"
  Draw-WireButton $graphics "Google Map" ($sx + 622) ($sy + 480) 200 56 "#7F1D1D" "#7F1D1D"

  Draw-RoundRect $graphics ($sx + 28) ($sy + 610) ($sw - 56) 735 24 $palette.Panel $palette.Border 3 $false
  Draw-Text $graphics "交換商品カード" ($sx + 56) ($sy + 642) 360 36 (New-UiFont 24 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-RoundRect $graphics ($sx + 58) ($sy + 692) 168 42 21 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "利用者QR読取" ($sx + 76) ($sy + 701) 132 22 (New-UiFont 15 ([System.Drawing.FontStyle]::Bold)) "#9F1239"
  Draw-RoundRect $graphics ($sx + 56) ($sy + 762) 170 132 18 "#FFE4E6" "#FDA4AF" 2 $false
  Draw-Text $graphics "商品画像" ($sx + 78) ($sy + 810) 126 28 (New-UiFont 18 ([System.Drawing.FontStyle]::Bold)) "#9F1239" "Center" "Center"
  Draw-Text $graphics "焼きたてパン引換券" ($sx + 260) ($sy + 762) 430 34 (New-UiFont 25 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-Text $graphics "カテゴリ  商店街の人気商品" ($sx + 260) ($sy + 818) 380 26 (New-UiFont 17) "#9F1239"
  Draw-Text $graphics "必要ポイント  180pt" ($sx + 260) ($sy + 858) 260 26 (New-UiFont 17 ([System.Drawing.FontStyle]::Bold)) "#9F1239"
  Draw-RoundRect $graphics ($sx + 56) ($sy + 930) 780 116 18 "#FFFFFF" $palette.Secondary 2 $false
  Draw-Text $graphics "説明: 商店街の協力店舗が用意する交換商品です。" ($sx + 82) ($sy + 960) 650 30 (New-UiFont 18) "#7F1D1D"

  Draw-RoundRect $graphics ($sx + 56) ($sy + 1088) 780 222 20 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "利用者QR読取" ($sx + 82) ($sy + 1112) 240 30 (New-UiFont 20 ([System.Drawing.FontStyle]::Bold)) $palette.Text
  Draw-WireButton $graphics "カメラで読む" ($sx + 82) ($sy + 1164) 220 56 "#7F1D1D" "#7F1D1D"
  Draw-RoundRect $graphics ($sx + 326) ($sy + 1164) 300 56 14 $palette.Panel $palette.Border 2 $false
  Draw-Text $graphics "QR内容を手入力" ($sx + 344) ($sy + 1180) 220 24 (New-UiFont 16) "#9F1239"
  Draw-WireButton $graphics "交換する" ($sx + 650) ($sy + 1164) 168 56 $palette.Primary $palette.Primary
  Draw-RoundRect $graphics ($sx + 82) ($sy + 1244) 320 48 14 "#DCFCE7" "#16A34A" 2 $false
  Draw-Text $graphics "交換完了: 山田太郎 / 180pt" ($sx + 100) ($sy + 1257) 280 22 (New-UiFont 15 ([System.Drawing.FontStyle]::Bold)) "#166534"

  Draw-Annotation $graphics "Store info #FFE4E6" 720 660 225
  Draw-Annotation $graphics "Product card #FFF7F7" 690 900 240
  Draw-Annotation $graphics "Scanner #FFE4E6" 735 1310 210

  Draw-RoundRect $graphics 1160 240 760 850 28 "#FFFFFF" "#FDA4AF" 3 $false
  Draw-Text $graphics "商店アプリの主要パーツ" 1200 282 620 42 (New-UiFont 28 ([System.Drawing.FontStyle]::Bold)) "#4C0519"
  Draw-Text $graphics "主催者側よりローズ寄りの赤を使い、店舗・商品・交換業務を強調する。" 1202 332 650 60 (New-UiFont 18) "#9F1239"
  $chipY = 430
  Draw-ColorChip $graphics "ページ背景" $palette.PageBg 1200 $chipY
  Draw-ColorChip $graphics "アプリ背景" $palette.AppBg 1200 ($chipY + 68)
  Draw-ColorChip $graphics "ヘッダー" $palette.Header 1200 ($chipY + 136)
  Draw-ColorChip $graphics "フォーム/読取面" $palette.Surface 1200 ($chipY + 204)
  Draw-ColorChip $graphics "商品カード面" $palette.Panel 1200 ($chipY + 272)
  Draw-ColorChip $graphics "主要ボタン" $palette.Primary 1200 ($chipY + 340)
  Draw-ColorChip $graphics "補助/入力線" $palette.Secondary 1200 ($chipY + 408)
  Draw-ColorChip $graphics "エラー" $palette.Error 1200 ($chipY + 476)

  Draw-RoundRect $graphics 1160 1160 760 690 28 "#FFFFFF" "#FDA4AF" 3 $false
  Draw-Text $graphics "状態別ワイヤー" 1200 1202 500 40 (New-UiFont 28 ([System.Drawing.FontStyle]::Bold)) "#4C0519"
  Draw-Text $graphics "1. 初期表示: 保存済み商店コードで自動読込" 1225 1274 630 32 (New-UiFont 19) "#1F2937"
  Draw-Text $graphics "2. 店舗情報: 住所と地図導線を上部に固定" 1225 1326 630 32 (New-UiFont 19) "#1F2937"
  Draw-Text $graphics "3. 商品一覧: 商品ごとに交換パネルを持つ" 1225 1378 630 32 (New-UiFont 19) "#1F2937"
  Draw-Text $graphics "4. カメラ不可: 手入力欄へ誘導" 1225 1430 630 32 (New-UiFont 19) "#1F2937"
  Draw-Text $graphics "5. 交換成功/失敗: 商品カード内に結果を固定表示" 1225 1482 630 32 (New-UiFont 19) "#1F2937"
  Draw-RoundRect $graphics 1220 1560 620 160 22 "#FFE4E6" "#BE123C" 3 $false
  Draw-Text $graphics "エラー表示例 #9F1239" 1250 1590 300 28 (New-UiFont 20 ([System.Drawing.FontStyle]::Bold)) "#9F1239"
  Draw-Text $graphics "ポイント不足 / QR期限切れ / 重複交換 / 商品対象外" 1250 1634 520 54 (New-UiFont 17) "#7F1D1D"

  Draw-RoundRect $graphics 2020 240 820 1610 28 "#FFFFFF" "#FDA4AF" 3 $false
  Draw-Text $graphics "実装対象画面" 2060 282 500 42 (New-UiFont 28 ([System.Drawing.FontStyle]::Bold)) "#4C0519"
  Draw-Text $graphics "商店側は来店時に繰り返し使う業務画面として、店舗情報と交換操作を同一画面内に集約する。" 2062 332 700 72 (New-UiFont 18) "#9F1239"
  Draw-RoundRect $graphics 2085 448 700 220 20 "#FFE4E6" "#BE123C" 2 $false
  Draw-Text $graphics "A. アクセスコード入力" 2120 486 420 30 (New-UiFont 21 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "codeをGET /api/bootstrapへ送信。401は同画面で再入力。" 2120 530 560 56 (New-UiFont 17) "#7F1D1D"
  Draw-RoundRect $graphics 2085 710 700 260 20 "#FFE4E6" "#BE123C" 2 $false
  Draw-Text $graphics "B. 店舗情報/地図" 2120 748 420 30 (New-UiFont 21 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "店舗名、住所、連絡先、Google Map検索リンクを赤基調の上部帯に表示。" 2120 792 560 82 (New-UiFont 17) "#7F1D1D"
  Draw-RoundRect $graphics 2085 1012 700 290 20 "#FFE4E6" "#BE123C" 2 $false
  Draw-Text $graphics "C. 商品カード" 2120 1050 420 30 (New-UiFont 21 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "商品画像、商品名、カテゴリ、必要ポイント、説明、交換操作をまとめる。" 2120 1094 560 82 (New-UiFont 17) "#7F1D1D"
  Draw-RoundRect $graphics 2085 1345 700 260 20 "#FFE4E6" "#BE123C" 2 $false
  Draw-Text $graphics "D. 交換結果" 2120 1383 420 30 (New-UiFont 21 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "成功は利用者名と利用pt、失敗は理由を商品カード内に表示。" 2120 1427 560 70 (New-UiFont 17) "#7F1D1D"

  $graphics.Flush()
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

$eventOutput = Join-Path $scriptRoot "linktown-event-organizer-wireframe.png"
$storeOutput = Join-Path $scriptRoot "linktown-store-portal-wireframe.png"
Draw-EventWireframe $eventOutput
Draw-StoreWireframe $storeOutput
Write-Host $eventOutput
Write-Host $storeOutput

