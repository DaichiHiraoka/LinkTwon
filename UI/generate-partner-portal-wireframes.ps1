Add-Type -AssemblyName System.Drawing

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Join-Path (Get-Location) "UI" }
$canvasW = 2100
$canvasH = 1300

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

function Draw-Line($graphics, $x1, $y1, $x2, $y2, $hex, $width = 3) {
  $pen = New-Pen $hex $width
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($pen, $x1, $y1, $x2, $y2)
  $pen.Dispose()
}

function Draw-Button($graphics, $label, $x, $y, $w, $h, $fill, $text = "#FFFFFF") {
  Draw-RoundRect $graphics $x $y $w $h 14 $fill $fill 2 $false
  Draw-Text $graphics $label $x ($y + 1) $w ($h - 2) (New-UiFont 19 ([System.Drawing.FontStyle]::Bold)) $text "Center" "Center"
}

function Draw-Input($graphics, $x, $y, $w, $h, $stroke, $fill = "#FFFFFF") {
  Draw-RoundRect $graphics $x $y $w $h 12 $fill $stroke 2 $false
}

function Draw-Chip($graphics, $label, $hex, $x, $y, $w = 274) {
  Draw-RoundRect $graphics $x $y $w 42 12 "#FFFFFF" "#FCA5A5" 2 $false
  Draw-RoundRect $graphics ($x + 12) ($y + 10) 32 22 6 $hex $hex 1 $false
  Draw-Text $graphics $label ($x + 54) ($y + 5) 128 18 (New-UiFont 13 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics $hex ($x + 54) ($y + 22) 110 16 (New-UiFont 12) "#7F1D1D"
}

function Draw-TopBar($graphics, $title, $palette) {
  Draw-RoundRect $graphics 36 28 2028 112 28 $palette.Header $palette.Header 1 $false
  Draw-Text $graphics "LinkTwon" 76 52 180 24 (New-UiFont 17 ([System.Drawing.FontStyle]::Bold)) "#FECACA"
  Draw-Text $graphics $title 76 78 760 42 (New-UiFont 30 ([System.Drawing.FontStyle]::Bold)) "#FFFFFF"
  Draw-Button $graphics "EN" 1954 62 64 46 $palette.Secondary "#450A0A"
  Draw-Text $graphics "Tablet 2100 x 1300" 1600 78 310 32 (New-UiFont 18 ([System.Drawing.FontStyle]::Bold)) "#FECACA" "Far" "Center"
}

function Draw-Palette($graphics, $palette, $x, $y, $title) {
  Draw-RoundRect $graphics $x $y 330 520 22 "#FFF7F7" $palette.Secondary 2 $false
  Draw-Text $graphics $title ($x + 20) ($y + 18) 290 34 (New-UiFont 22 ([System.Drawing.FontStyle]::Bold)) $palette.Dark
  $chipY = $y + 66
  Draw-Chip $graphics "背景" $palette.PageBg ($x + 20) $chipY
  Draw-Chip $graphics "ヘッダー" $palette.Header ($x + 20) ($chipY + 52)
  Draw-Chip $graphics "面/帯" $palette.Surface ($x + 20) ($chipY + 104)
  Draw-Chip $graphics "カード" $palette.Panel ($x + 20) ($chipY + 156)
  Draw-Chip $graphics "主要ボタン" $palette.Primary ($x + 20) ($chipY + 208)
  Draw-Chip $graphics "補助線" $palette.Secondary ($x + 20) ($chipY + 260)
  Draw-Chip $graphics "枠線" $palette.Border ($x + 20) ($chipY + 312)
  Draw-Chip $graphics "エラー" $palette.Error ($x + 20) ($chipY + 364)
}

function Draw-AccessPanel($graphics, $x, $y, $w, $palette, $label, $button) {
  Draw-RoundRect $graphics $x $y $w 132 22 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics $label ($x + 24) ($y + 20) 280 24 (New-UiFont 17 ([System.Drawing.FontStyle]::Bold)) $palette.Dark
  Draw-Input $graphics ($x + 24) ($y + 62) ($w - 260) 48 $palette.Border "#FFFFFF"
  Draw-Button $graphics $button ($x + $w - 212) ($y + 62) 188 48 $palette.Primary
}

function Draw-Scanner($graphics, $x, $y, $w, $palette, $title, $button, $result) {
  Draw-RoundRect $graphics $x $y $w 166 20 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics $title ($x + 22) ($y + 18) 260 28 (New-UiFont 20 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Button $graphics "カメラで読む" ($x + 22) ($y + 66) 180 50 $palette.Dark
  Draw-Input $graphics ($x + 222) ($y + 66) ($w - 434) 50 $palette.Border "#FFFFFF"
  Draw-Text $graphics "QR内容を手入力" ($x + 242) ($y + 80) 190 22 (New-UiFont 15) "#7F1D1D"
  Draw-Button $graphics $button ($x + $w - 190) ($y + 66) 168 50 $palette.Primary
  Draw-RoundRect $graphics ($x + 22) ($y + 126) 330 28 10 "#DCFCE7" "#16A34A" 2 $false
  Draw-Text $graphics $result ($x + 36) ($y + 131) 300 18 (New-UiFont 13 ([System.Drawing.FontStyle]::Bold)) "#166534"
}

function Draw-EventScreen($outputPath) {
  $palette = @{
    PageBg = "#FFF1F2"; Header = "#7F1D1D"; Surface = "#FEE2E2"; Panel = "#FFFFFF";
    Primary = "#DC2626"; Secondary = "#FCA5A5"; Border = "#B91C1C"; Dark = "#450A0A"; Error = "#991B1B";
  }

  $bitmap = New-Object System.Drawing.Bitmap $canvasW, $canvasH
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear((ColorFromHex $palette.PageBg))

  Draw-TopBar $graphics "イベント主催者ポータル" $palette
  Draw-AccessPanel $graphics 48 168 1260 $palette "主催者アクセスコード" "イベントを表示"

  Draw-RoundRect $graphics 1338 168 690 132 22 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "主催者" 1366 190 140 22 (New-UiFont 16 ([System.Drawing.FontStyle]::Bold)) $palette.Dark
  Draw-Text $graphics "〇〇地域イベント実行委員会" 1366 222 360 32 (New-UiFont 23 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "organizer@example.com" 1366 260 320 22 (New-UiFont 15) "#7F1D1D"

  Draw-RoundRect $graphics 48 332 1282 890 26 $palette.Panel $palette.Border 3 $false
  Draw-Text $graphics "担当イベントカード" 86 368 420 40 (New-UiFont 27 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-RoundRect $graphics 86 426 184 42 21 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "参加者QR読取" 106 435 140 22 (New-UiFont 15 ([System.Drawing.FontStyle]::Bold)) $palette.Error
  Draw-Text $graphics "商店街清掃ボランティア" 86 494 520 38 (New-UiFont 30 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "開催日時  2026/06/22 10:00" 86 560 360 28 (New-UiFont 18) "#7F1D1D"
  Draw-Text $graphics "集合場所  〇〇商店街中央広場" 86 604 420 28 (New-UiFont 18) "#7F1D1D"
  Draw-Text $graphics "付与ポイント  100pt" 840 560 300 28 (New-UiFont 19 ([System.Drawing.FontStyle]::Bold)) $palette.Error
  Draw-RoundRect $graphics 86 676 1184 190 18 "#FFF7F7" $palette.Secondary 2 $false
  Draw-Text $graphics "説明 / 活動内容 / 注意事項" 116 704 380 28 (New-UiFont 20 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Line $graphics 116 760 1210 760 $palette.Secondary 6
  Draw-Line $graphics 116 812 980 812 $palette.Secondary 6
  Draw-Scanner $graphics 86 906 1184 $palette "参加者QR読取" "受付する" "受付完了: 山田太郎 / 100pt"

  Draw-RoundRect $graphics 1362 332 666 430 22 "#FFF7F7" $palette.Secondary 2 $false
  Draw-Text $graphics "状態別ワイヤー" 1392 366 360 34 (New-UiFont 26 ([System.Drawing.FontStyle]::Bold)) $palette.Dark
  Draw-Text $graphics "1. 起動時に保存済みcodeで自動読込" 1418 430 520 28 (New-UiFont 18) "#1F2937"
  Draw-Text $graphics "2. 401はフォーム下に赤エラー表示" 1418 480 520 28 (New-UiFont 18) "#1F2937"
  Draw-Text $graphics "3. イベントごとにQR読取パネルを持つ" 1418 530 520 28 (New-UiFont 18) "#1F2937"
  Draw-Text $graphics "4. カメラ不可時は手入力へ誘導" 1418 580 520 28 (New-UiFont 18) "#1F2937"
  Draw-Text $graphics "5. 受付結果はカード内に固定表示" 1418 630 520 28 (New-UiFont 18) "#1F2937"
  Draw-RoundRect $graphics 1408 684 540 46 12 $palette.Surface $palette.Error 2 $false
  Draw-Text $graphics "エラー #991B1B: QR期限切れ / 重複受付 / 対象イベントなし" 1428 696 500 20 (New-UiFont 14 ([System.Drawing.FontStyle]::Bold)) $palette.Error

  Draw-Palette $graphics $palette 1362 802 "パーツ別カラーコード"
  Draw-Text $graphics "画面前提: 横2100px × 縦1300px タブレット" 52 1240 980 30 (New-UiFont 18 ([System.Drawing.FontStyle]::Bold)) "#7F1D1D"

  $graphics.Flush()
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Draw-StoreScreen($outputPath) {
  $palette = @{
    PageBg = "#FFF1F2"; Header = "#9F1239"; Surface = "#FFE4E6"; Panel = "#FFF7F7";
    Primary = "#E11D48"; Secondary = "#FDA4AF"; Border = "#BE123C"; Dark = "#4C0519"; Error = "#9F1239";
  }

  $bitmap = New-Object System.Drawing.Bitmap $canvasW, $canvasH
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear((ColorFromHex $palette.PageBg))

  Draw-TopBar $graphics "商店ポータル" $palette
  Draw-AccessPanel $graphics 48 168 960 $palette "商店アクセスコード" "商品を表示"

  Draw-RoundRect $graphics 1040 168 988 132 22 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "店舗情報" 1068 190 140 22 (New-UiFont 16 ([System.Drawing.FontStyle]::Bold)) $palette.Dark
  Draw-Text $graphics "まちのパン屋" 1068 222 260 32 (New-UiFont 25 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "東京都千代田区有楽町1丁目 / store@example.com" 1068 262 520 22 (New-UiFont 15) "#9F1239"
  Draw-Button $graphics "Google Map" 1814 214 170 50 $palette.Dark

  Draw-RoundRect $graphics 48 332 1282 890 26 $palette.Panel $palette.Border 3 $false
  Draw-Text $graphics "交換商品カード" 86 368 420 40 (New-UiFont 27 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-RoundRect $graphics 86 426 176 42 21 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "利用者QR読取" 106 435 136 22 (New-UiFont 15 ([System.Drawing.FontStyle]::Bold)) $palette.Error
  Draw-RoundRect $graphics 86 500 250 180 20 $palette.Surface $palette.Secondary 2 $false
  Draw-Text $graphics "商品画像" 86 570 250 32 (New-UiFont 22 ([System.Drawing.FontStyle]::Bold)) $palette.Error "Center" "Center"
  Draw-Text $graphics "焼きたてパン引換券" 382 506 460 38 (New-UiFont 30 ([System.Drawing.FontStyle]::Bold)) "#1F2937"
  Draw-Text $graphics "カテゴリ  商店街の人気商品" 382 572 380 28 (New-UiFont 18) "#9F1239"
  Draw-Text $graphics "必要ポイント  180pt" 382 616 300 28 (New-UiFont 19 ([System.Drawing.FontStyle]::Bold)) $palette.Error
  Draw-RoundRect $graphics 86 718 1184 132 18 "#FFFFFF" $palette.Secondary 2 $false
  Draw-Text $graphics "説明: 商店街の協力店舗が用意する交換商品です。" 116 762 800 30 (New-UiFont 20) "#7F1D1D"
  Draw-Scanner $graphics 86 900 1184 $palette "利用者QR読取" "交換する" "交換完了: 山田太郎 / 180pt"

  Draw-RoundRect $graphics 1362 332 666 430 22 "#FFF7F7" $palette.Secondary 2 $false
  Draw-Text $graphics "状態別ワイヤー" 1392 366 360 34 (New-UiFont 26 ([System.Drawing.FontStyle]::Bold)) $palette.Dark
  Draw-Text $graphics "1. 起動時に保存済みstore codeで自動読込" 1418 430 560 28 (New-UiFont 18) "#1F2937"
  Draw-Text $graphics "2. 店舗情報と地図導線を上部固定" 1418 480 560 28 (New-UiFont 18) "#1F2937"
  Draw-Text $graphics "3. 商品ごとに交換パネルを持つ" 1418 530 560 28 (New-UiFont 18) "#1F2937"
  Draw-Text $graphics "4. カメラ不可時は手入力へ誘導" 1418 580 560 28 (New-UiFont 18) "#1F2937"
  Draw-Text $graphics "5. 交換結果は商品カード内に固定表示" 1418 630 560 28 (New-UiFont 18) "#1F2937"
  Draw-RoundRect $graphics 1408 684 540 46 12 $palette.Surface $palette.Error 2 $false
  Draw-Text $graphics "エラー #9F1239: ポイント不足 / QR期限切れ / 重複交換 / 商品対象外" 1428 696 500 20 (New-UiFont 14 ([System.Drawing.FontStyle]::Bold)) $palette.Error

  Draw-Palette $graphics $palette 1362 802 "パーツ別カラーコード"
  Draw-Text $graphics "画面前提: 横2100px × 縦1300px タブレット" 52 1240 980 30 (New-UiFont 18 ([System.Drawing.FontStyle]::Bold)) "#9F1239"

  $graphics.Flush()
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

$eventOutput = Join-Path $scriptRoot "linktown-event-organizer-wireframe.png"
$storeOutput = Join-Path $scriptRoot "linktown-store-portal-wireframe.png"
Draw-EventScreen $eventOutput
Draw-StoreScreen $storeOutput
Write-Host $eventOutput
Write-Host $storeOutput

