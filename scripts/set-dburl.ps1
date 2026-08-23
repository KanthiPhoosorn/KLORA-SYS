# Reads the Neon "Pooled" connection string from your clipboard and writes it into
# .env.local as DATABASE_URL, without printing the secret. Run:
#   powershell -NoProfile -ExecutionPolicy Bypass -File D:\KLORA-SYS\scripts\set-dburl.ps1

$u = ((Get-Clipboard) -join '').Trim()

if ($u -notmatch '^postgres') {
    Write-Host 'Clipboard is not a Postgres URL. Copy the Neon Pooled connection string first, then re-run.'
    exit 1
}

$path = 'D:\KLORA-SYS\.env.local'
$keep = Get-Content $path | Where-Object { $_ -notmatch '^DATABASE_URL=' }
($keep + ('DATABASE_URL=' + $u)) | Set-Content $path -Encoding utf8

if ($u -match 'pooler') {
    Write-Host 'DATABASE_URL saved to .env.local (pooled connection - good).'
} else {
    Write-Host 'DATABASE_URL saved, but it does NOT contain "pooler". Consider using the Pooled string for Vercel.'
}
