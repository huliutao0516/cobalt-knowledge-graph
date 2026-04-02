param(
  [int]$Port = 8765,
  [string]$Host = "127.0.0.1"
)

$root = Split-Path -Parent $PSScriptRoot
$url = "http://$Host`:$Port/cobalt_geoscene_preview.html"

Write-Host "Serving preview from $root"
Write-Host "Open: $url"

Push-Location $root
try {
  python -m http.server $Port --bind $Host
}
finally {
  Pop-Location
}
