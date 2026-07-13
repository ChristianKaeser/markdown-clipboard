# Generates the Chrome Web Store small promo tile (440x280): the Ultraviolet
# gradient background (#7C3AED -> #C026D3) with the white Markdown mark and the
# "Markdown Clipboard" wordmark. Full-bleed, no rounded corners (the store draws
# its own frame). Run: powershell -File scripts/make-promo.ps1
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\store'
New-Item -ItemType Directory -Force $outDir | Out-Null

$width = 440
$height = 280
$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'

# Full-bleed diagonal Ultraviolet gradient.
$rect = New-Object System.Drawing.RectangleF(0, 0, $width, $height)
$c1 = [System.Drawing.Color]::FromArgb(255, 124, 58, 237)  # #7C3AED violet
$c2 = [System.Drawing.Color]::FromArgb(255, 192, 38, 211)  # #C026D3 magenta
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 25)
$g.FillRectangle($bg, 0, 0, $width, $height)
$bg.Dispose()

# White Markdown mark, centered above the wordmark. Coordinates share the
# 100x100 design grid used by the icons; the mark itself spans x 14..92, y 31..69.
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$scale = 84.0 / 38.0            # target mark height ~84px
$markWidth = 78 * $scale
$offsetX = ($width - $markWidth) / 2
$offsetY = 44
function Grid([double]$px, [double]$py) {
    New-Object System.Drawing.PointF(($offsetX + (($px - 14) * $scale)), ($offsetY + (($py - 31) * $scale)))
}

$mPoints = @(
    (Grid 14 69), (Grid 14 31), (Grid 26 31), (Grid 37 45), (Grid 48 31), (Grid 60 31),
    (Grid 60 69), (Grid 48 69), (Grid 48 49), (Grid 37 62), (Grid 26 49), (Grid 26 69)
)
$g.FillPolygon($white, $mPoints)

$aPoints = @(
    (Grid 73 31), (Grid 83 31), (Grid 83 52), (Grid 92 52), (Grid 78 69), (Grid 64 52), (Grid 73 52)
)
$g.FillPolygon($white, $aPoints)

# Wordmark + tagline, centered.
$center = New-Object System.Drawing.StringFormat
$center.Alignment = 'Center'
$center.LineAlignment = 'Center'

$titleFont = New-Object System.Drawing.Font('Segoe UI', 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$titleRect = New-Object System.Drawing.RectangleF(0, 168, $width, 52)
$g.DrawString('Markdown Clipboard', $titleFont, $white, $titleRect, $center)

$tagBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 255, 255, 255))
$tagFont = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$tagRect = New-Object System.Drawing.RectangleF(0, 220, $width, 30)
$g.DrawString('HTML clipboard ' + [char]0x2192 + ' clean Markdown', $tagFont, $tagBrush, $tagRect, $center)

$g.Dispose()
$bmp.Save((Join-Path $outDir 'promo-440x280.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host 'store/promo-440x280.png written'
