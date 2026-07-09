# Generates the extension icons: a rounded dark tile with the Markdown "M"
# and a down arrow, drawn as vector paths (no font rendering) so small sizes
# stay crisp. Run: powershell -File scripts/make-icons.ps1
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $outDir | Out-Null

foreach ($size in 16, 32, 48, 128) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'

    # Rounded-rect background tile
    $radius = [Math]::Max([int]($size * 0.19), 2)
    $rect = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $w = $size - 1
    $rect.AddArc(0, 0, $d, $d, 180, 90)
    $rect.AddArc($w - $d, 0, $d, $d, 270, 90)
    $rect.AddArc($w - $d, $w - $d, $d, $d, 0, 90)
    $rect.AddArc(0, $w - $d, $d, $d, 90, 90)
    $rect.CloseFigure()
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 36, 41, 47))
    $g.FillPath($bg, $rect)

    # Markdown mark: "M" followed by a down arrow, as scaled polygons.
    # Coordinates are relative to a 100x100 design grid (the official
    # markdown-mark proportions, slightly condensed to fit a square tile).
    $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $s = $size / 100.0

    # "M" glyph: outer stroke path as polygon
    $mPoints = @(
        @(14, 69), @(14, 31), @(26, 31), @(37, 45), @(48, 31), @(60, 31), @(60, 69), @(48, 69), @(48, 49), @(37, 62), @(26, 49), @(26, 69)
    ) | ForEach-Object { New-Object System.Drawing.PointF(($_[0] * $s), ($_[1] * $s)) }
    $g.FillPolygon($white, $mPoints)

    # Down arrow
    $aPoints = @(
        @(73, 31), @(83, 31), @(83, 52), @(92, 52), @(78, 69), @(64, 52), @(73, 52)
    ) | ForEach-Object { New-Object System.Drawing.PointF(($_[0] * $s), ($_[1] * $s)) }
    $g.FillPolygon($white, $aPoints)

    $g.Dispose()
    $bmp.Save((Join-Path $outDir "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "icon-$size.png written"
}
