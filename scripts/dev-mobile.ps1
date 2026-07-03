param(
  [switch]$Clear
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'sondar-mobile'
$npm = (Get-Command npm.cmd).Source

function Test-LocalPort([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $result = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $result.AsyncWaitHandle.WaitOne(250)) { return $false }
    $client.EndConnect($result)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

if (-not (Test-LocalPort 3000)) {
  Write-Host 'Iniciando backend SONDAR...' -ForegroundColor DarkGray
  Start-Process -FilePath $npm `
    -ArgumentList 'run', 'start_server' `
    -WorkingDirectory $root `
    -WindowStyle Hidden | Out-Null

  $backendListo = $false
  for ($intento = 0; $intento -lt 40; $intento++) {
    Start-Sleep -Milliseconds 250
    if (Test-LocalPort 3000) {
      $backendListo = $true
      break
    }
  }

  if (-not $backendListo) {
    throw 'El backend no pudo iniciar en el puerto 3000.'
  }
}

Write-Host 'Backend listo. Iniciando Expo...' -ForegroundColor Green
Push-Location $mobile
try {
  if ($Clear) {
    & $npm run start:clear
  } else {
    & $npm start
  }
} finally {
  Pop-Location
}
