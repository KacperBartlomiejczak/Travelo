<#
  Builds the bundled trip cover presets: see prompts/trip-covers/plan.md, C1.
  One-off Windows tool (System.Drawing exists only on Windows, plan risk R2). It is not part of
  the build; the converted files in assets/covers/ are committed.

  For every id found in -Source (e.g. Majorka-sm.jpg -> "majorka") it writes into -Out:
    <id>.jpg        longer side at most 2048 px, JPEG quality 80
    <id>_thumb.jpg  longer side at most 480 px, JPEG quality 80
  Never upscales. Applies the EXIF orientation of the source; the output carries no EXIF.
  When several files map to one id (e.g. -sm and -md), the one with the most pixels wins.
#>
param(
  [string]$Source = (Join-Path $PSScriptRoot '..\assets\template-images'),
  [string]$Out = (Join-Path $PSScriptRoot '..\assets\covers')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$Quality = 80
$FullMax = 2048
$ThumbMax = 480

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

function Get-CoverId([string]$fileName) {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($fileName).ToLowerInvariant()
  return ($name -replace '[-_](sm|md|lg|xs|xl|small|medium|large)$', '')
}

function Resize-ToFile([System.Drawing.Image]$image, [int]$maxSide, [string]$path) {
  $longer = [Math]::Max($image.Width, $image.Height)
  $scale = [Math]::Min(1.0, $maxSide / $longer)
  $w = [int][Math]::Round($image.Width * $scale)
  $h = [int][Math]::Round($image.Height * $scale)
  $bitmap = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  try {
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.DrawImage($image, 0, 0, $w, $h)
    } finally { $g.Dispose() }
    $bitmap.Save($path, $jpegCodec, $encoderParams)
  } finally { $bitmap.Dispose() }
}

function Open-Upright([string]$path) {
  $image = [System.Drawing.Image]::FromFile($path)
  if ($image.PropertyIdList -contains 0x0112) {
    switch ($image.GetPropertyItem(0x0112).Value[0]) {
      2 { $image.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
      3 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
      4 { $image.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipY) }
      5 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
      6 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
      7 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
      8 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }
  }
  return $image
}

try {
  $sourceDir = (Resolve-Path $Source).Path
  if (-not (Test-Path $Out)) { New-Item -ItemType Directory -Path $Out | Out-Null }
  $outDir = (Resolve-Path $Out).Path

  # Pick, per id, the source file with the most pixels.
  $best = @{}
  foreach ($file in Get-ChildItem -Path $sourceDir -Filter *.jpg) {
    $probe = [System.Drawing.Image]::FromFile($file.FullName)
    try { $pixels = [long]$probe.Width * [long]$probe.Height } finally { $probe.Dispose() }
    $id = Get-CoverId $file.Name
    if (-not $best.ContainsKey($id) -or $pixels -gt $best[$id].Pixels) {
      $best[$id] = @{ Path = $file.FullName; Pixels = $pixels }
    }
  }

  foreach ($id in ($best.Keys | Sort-Object)) {
    $image = Open-Upright $best[$id].Path
    try {
      Resize-ToFile $image $FullMax (Join-Path $outDir "$id.jpg")
      Resize-ToFile $image $ThumbMax (Join-Path $outDir "${id}_thumb.jpg")
    } finally { $image.Dispose() }
    Write-Host "$id <- $([System.IO.Path]::GetFileName($best[$id].Path))"
  }
} finally {
  $encoderParams.Param[0].Dispose()
  $encoderParams.Dispose()
}
