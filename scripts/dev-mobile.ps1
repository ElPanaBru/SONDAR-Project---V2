param(
  [switch]$Clear,
  [switch]$Tunnel
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'sondar-mobile'
$npm = (Get-Command npm.cmd).Source
$metroPort = 8081

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

function Test-MetroPort([int]$Port) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/status" -UseBasicParsing -TimeoutSec 2
    $content = $response.Content
    if ($content -is [byte[]]) {
      $content = [System.Text.Encoding]::UTF8.GetString($content)
    }
    return ($content -match 'packager-status:running')
  } catch {
    return $false
  }
}

function Get-LanIPv4 {
  $candidates = @()
  $interfaces = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()

  foreach ($adapter in $interfaces) {
    if ($adapter.OperationalStatus -ne [System.Net.NetworkInformation.OperationalStatus]::Up) { continue }
    if ($adapter.NetworkInterfaceType -eq [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback) { continue }

    $properties = $adapter.GetIPProperties()
    $hasGateway = @($properties.GatewayAddresses | Where-Object {
        $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        $_.Address.ToString() -ne '0.0.0.0'
      }).Count -gt 0

    foreach ($addressInfo in $properties.UnicastAddresses) {
      if ($addressInfo.Address.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { continue }

      $ip = $addressInfo.Address.ToString()
      if ($ip -match '^127\.' -or $ip -match '^169\.254\.') { continue }

      $candidates += [PSCustomObject]@{
        IP = $ip
        HasGateway = $hasGateway
      }
    }
  }

  return $candidates |
    Sort-Object -Property @{ Expression = 'HasGateway'; Descending = $true } |
    Select-Object -First 1 -ExpandProperty IP
}

function Get-PortListenerPid([int]$Port) {
  $lines = & netstat -ano -p tcp
  foreach ($line in $lines) {
    if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") {
      return [int]$Matches[1]
    }
  }
  return $null
}

function Stop-MetroPort([int]$Port) {
  $listenerPid = Get-PortListenerPid $Port
  if (-not $listenerPid) { return }

  Write-Host "Cerrando Metro viejo en el puerto $Port..." -ForegroundColor DarkGray
  Stop-Process -Id $listenerPid -Force

  for ($intento = 0; $intento -lt 30; $intento++) {
    Start-Sleep -Milliseconds 200
    if (-not (Test-LocalPort $Port)) { return }
  }

  throw "No se pudo liberar el puerto $Port."
}

function Stop-MobileDevProcesses {
  $escapedMobile = [regex]::Escape($mobile)
  try {
    $processes = Get-CimInstance Win32_Process |
      Where-Object {
        $_.ProcessId -ne $PID -and
        $_.CommandLine -match $escapedMobile -and
        $_.Name -match '^(node|cmd|npm)(\.exe)?$'
      }

    foreach ($process in $processes) {
      Write-Host "Cerrando proceso viejo de Expo ($($process.ProcessId))..." -ForegroundColor DarkGray
      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
  } catch {
    Write-Host 'No pude inspeccionar procesos viejos de Expo; sigo con la limpieza por puerto.' -ForegroundColor DarkGray
  }
}

function Start-MobileExpo([string]$ScriptName) {
  $maxAttempts = if ($Tunnel) { 3 } else { 1 }

  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    if ($Tunnel -and $attempt -gt 1) {
      Write-Host "Reintentando tunnel de Expo ($attempt/$maxAttempts)..." -ForegroundColor Yellow
      Start-Sleep -Seconds 2
    }

    & $npm --prefix $mobile run $ScriptName
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0 -or -not $Tunnel) {
      exit $exitCode
    }
  }

  exit $LASTEXITCODE
}

$lanIp = Get-LanIPv4
$expoUrl = if ($lanIp) { "exp://${lanIp}:$metroPort" } else { "exp://<IP-DE-TU-PC>:$metroPort" }

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

if ($Clear -or $Tunnel) {
  Stop-MobileDevProcesses
}

if (($Clear -or $Tunnel) -and (Test-MetroPort $metroPort)) {
  Stop-MetroPort $metroPort
} elseif (Test-LocalPort $metroPort) {
  if (Test-MetroPort $metroPort) {
    Write-Host "Expo ya esta corriendo en el puerto $metroPort." -ForegroundColor Green
    Write-Host "Abrilo desde Expo Go con $expoUrl" -ForegroundColor DarkGray
    return
  }

  throw "El puerto $metroPort esta ocupado por otra aplicacion. Cerrala y volve a ejecutar este comando."
}

if ($lanIp -and -not $Tunnel) {
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp
}

if ($Tunnel) {
  $env:NODE_OPTIONS = "$($env:NODE_OPTIONS) --dns-result-order=ipv4first".Trim()
}

Write-Host 'Backend listo. Iniciando Expo...' -ForegroundColor Green
if ($Tunnel) {
  Write-Host 'Modo tunnel activo: no usa puertos entrantes del firewall.' -ForegroundColor DarkGray
} else {
  Write-Host "Expo LAN: $expoUrl" -ForegroundColor DarkGray
}

if ($Tunnel -and $Clear) {
  Start-MobileExpo 'start:tunnel:clear'
} elseif ($Tunnel) {
  Start-MobileExpo 'start:tunnel'
} elseif ($Clear) {
  Start-MobileExpo 'start:clear'
} else {
  Start-MobileExpo 'start'
}
