# Minimal static web server for the prebuilt Vastra AR site (no Node.js needed).
# Serves ./dist on http://localhost:5173 - localhost counts as a secure origin,
# so browsers allow camera access. Usage:
#   powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Root dist] [-Port 5173] [-NoBrowser]
param(
  [string]$Root = (Join-Path $PSScriptRoot '..\dist'),
  [int]$Port = 5173,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path $Root).Path.TrimEnd('\') + '\'

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'
  '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.wasm' = 'application/wasm'
  '.task' = 'application/octet-stream'; '.tflite' = 'application/octet-stream'; '.bin' = 'application/octet-stream'; '.txt' = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not start the server on port ${Port}: $($_.Exception.Message)" -ForegroundColor Red
  exit 2
}

Write-Host ""
Write-Host "  Vastra AR is running at $prefix" -ForegroundColor Yellow
Write-Host "  Keep this window open while you use the app. Press Ctrl+C or close it to stop."
Write-Host ""
if (-not $NoBrowser) { Start-Process $prefix }

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrEmpty($rel) -or $rel.EndsWith('/')) { $rel = $rel + 'index.html' }
      $full = [System.IO.Path]::GetFullPath((Join-Path $Root ($rel -replace '/', '\')))
      if ($full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
        if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
        $res.AddHeader('Cache-Control', 'no-cache')
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        $msg = [Text.Encoding]::UTF8.GetBytes("Not found: /$rel")
        $res.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      # client went away mid-transfer; keep serving
    } finally {
      try { $res.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
