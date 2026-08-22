# KLORA — run the app + a public Cloudflare tunnel from your own machine.
# Keep THIS window open (it shows your shareable URL and runs the tunnel).
# A second window runs the app server — keep that open too. Close either to stop.
$ErrorActionPreference = 'Stop'
Set-Location 'D:\KLORA-SYS'

Write-Host '== Building production bundle (fast if unchanged) ==' -ForegroundColor Cyan
npm run build

Write-Host '== Starting app server on http://localhost:3100 (opens a new window) ==' -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit','-Command','Set-Location ''D:\KLORA-SYS''; $env:PORT=''3100''; npm start'

Write-Host 'Waiting for the server to come up...' -ForegroundColor DarkGray
$up = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    if ((Invoke-WebRequest 'http://localhost:3100' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { $up = $true; break }
  } catch { }
  Start-Sleep -Seconds 1
}
if (-not $up) { Write-Host 'Server did not respond yet — the tunnel may 5xx until it does.' -ForegroundColor Yellow }

Write-Host ''
Write-Host '== Opening public tunnel — copy the https://...trycloudflare.com URL below ==' -ForegroundColor Green
Write-Host '   (Login for the demo: farm / password123)' -ForegroundColor DarkGray
Write-Host ''
cloudflared tunnel --url http://localhost:3100
