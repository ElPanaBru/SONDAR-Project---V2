param()

$ErrorActionPreference = 'Stop'
$metroPort = 8081
$apiPort = 3000
$allowedPorts = @($apiPort, $metroPort)
$blockedTcpPorts = @('1-2999', '3001-8080', '8082-65535')

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $elevated = Start-Process `
    -FilePath 'powershell.exe' `
    -Verb RunAs `
    -WindowStyle Hidden `
    -Wait `
    -PassThru `
    -ArgumentList @(
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', "`"$PSCommandPath`""
    )

  if ($elevated.ExitCode -ne 0) {
    throw 'Windows no pudo aplicar la configuracion del Firewall.'
  }

  exit 0
}

$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$privateNodeBlocks = Get-NetFirewallRule -Enabled True -Direction Inbound |
  Where-Object {
    $_.DisplayName -eq 'Node.js JavaScript Runtime' -and
    $_.Profile -match 'Private' -and
    $_.Action -eq 'Block'
  }

foreach ($rule in $privateNodeBlocks) {
  $app = $rule | Get-NetFirewallApplicationFilter
  $port = $rule | Get-NetFirewallPortFilter

  if (
    $app.Program -ieq $nodePath -and
    $port.Protocol -eq 'TCP' -and
    $port.LocalPort -eq 'Any'
  ) {
    $rule | Set-NetFirewallRule -Protocol TCP -LocalPort $blockedTcpPorts
  }
}

$rules = @(
  @{ DisplayName = 'SONDAR Backend API 3000'; Port = $apiPort },
  @{ DisplayName = 'SONDAR Expo Metro 8081'; Port = $metroPort }
)

foreach ($definition in $rules) {
  $existing = @(Get-NetFirewallRule -DisplayName $definition.DisplayName -ErrorAction SilentlyContinue)

  if ($existing.Count -eq 0) {
    New-NetFirewallRule `
      -DisplayName $definition.DisplayName `
      -Direction Inbound `
      -Action Allow `
      -Enabled True `
      -Profile Private `
      -Protocol TCP `
      -LocalPort $definition.Port `
      -RemoteAddress LocalSubnet `
      -Program $nodePath | Out-Null
    continue
  }

  foreach ($rule in $existing) {
    $rule | Set-NetFirewallRule `
      -Direction Inbound `
      -Action Allow `
      -Enabled True `
      -Profile Private `
      -Protocol TCP `
      -LocalPort $definition.Port `
      -RemoteAddress LocalSubnet `
      -Program $nodePath
  }
}

Write-Host 'Firewall listo para SONDAR en la red privada.' -ForegroundColor Green
Write-Host "Puertos permitidos desde la subred local: $($allowedPorts -join ', ')" -ForegroundColor DarkGray
