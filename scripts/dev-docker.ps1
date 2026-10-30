param(
  [ValidateSet('up', 'down', 'status')]
  [string]$Action = 'up',
  [switch]$Clear
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$composeFile = Join-Path $repoRoot 'compose.yaml'
$supabaseConfig = Join-Path $repoRoot 'supabase\config.toml'
$supabaseCli = Join-Path $repoRoot 'node_modules\.bin\supabase.cmd'
$networkName = 'sondar-local'

function Invoke-CapturedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$Purpose
  )

  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = @(& $FilePath @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0) {
    throw "$Purpose fallo (codigo $exitCode). Revisa Docker Desktop y la configuracion local."
  }
  return ($output | ForEach-Object { [string]$_ }) -join "`n"
}

function Invoke-SupabaseCommand {
  param([string[]]$Arguments, [string]$Purpose)
  Push-Location $repoRoot
  try {
    return Invoke-CapturedCommand -FilePath $supabaseCli -Arguments $Arguments -Purpose $Purpose
  } finally {
    Pop-Location
  }
}

function Get-ProjectId {
  $configText = Get-Content -LiteralPath $supabaseConfig -Raw
  $match = [regex]::Match($configText, '(?m)^\s*project_id\s*=\s*"([^"]+)"')
  if (-not $match.Success) { throw 'No se encontro project_id en supabase/config.toml.' }
  return $match.Groups[1].Value
}

function Get-StatusValue {
  param([object]$Status, [string[]]$Names)
  foreach ($name in $Names) {
    $property = $Status.PSObject.Properties | Where-Object { $_.Name -ieq $name } | Select-Object -First 1
    if ($property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
      return [string]$property.Value
    }
  }
  return ''
}

function ConvertTo-EnvValue {
  param([Parameter(Mandatory = $true)][string]$Value)
  if ($Value -match '[\r\n]') { throw 'Una variable local contiene saltos de linea no admitidos.' }
  $slash = [string][char]92
  $quote = [string][char]39
  $escaped = $Value.Replace($quote, $slash + $quote)
  return $quote + $escaped + $quote
}

function Write-EnvFile {
  param([string]$Path, [string[]]$Lines)
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, (($Lines -join "`n") + "`n"), $encoding)
}

function Get-LanIPv4 {
  $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
    Where-Object { $_.NextHop -and $_.NextHop -ne '0.0.0.0' } |
    Sort-Object RouteMetric, InterfaceMetric |
    Select-Object -First 1
  if (-not $route) { throw 'No se encontro la ruta IPv4 predeterminada para anunciar Metro en la LAN.' }

  $address = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.IPAddress -notlike '0.*'
    } |
    Select-Object -First 1
  if (-not $address) { throw 'No se encontro una IPv4 LAN valida para Metro.' }
  return $address.IPAddress
}

function Ensure-SharedNetwork {
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $inspect = @(& docker network inspect $networkName 2>$null)
    $inspectExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }

  if ($inspectExitCode -eq 0) {
    $network = (($inspect | ForEach-Object { [string]$_ }) -join "`n" | ConvertFrom-Json)[0]
    $binding = $network.Options.'com.docker.network.bridge.host_binding_ipv4'
    if ($network.Driver -ne 'bridge' -or $binding -ne '127.0.0.1') {
      throw "La red Docker '$networkName' ya existe sin el enlace local esperado (127.0.0.1)."
    }
    return
  }

  [void](Invoke-CapturedCommand -FilePath 'docker' -Arguments @(
    'network', 'create', '--driver', 'bridge',
    '--opt', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1',
    '--label', 'com.sondar.scope=local-development', $networkName
  ) -Purpose 'Crear la red compartida de Docker')
}

function Assert-LocalSupabaseBindings {
  param([string[]]$ContainerNames)
  foreach ($containerName in $ContainerNames) {
    $running = @(& docker ps --filter "name=^/$containerName$" --format '{{.Names}}' 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $running) { continue }

    $inspectText = Invoke-CapturedCommand -FilePath 'docker' -Arguments @('inspect', $containerName) -Purpose "Inspeccionar $containerName"
    $container = ($inspectText | ConvertFrom-Json)[0]
    foreach ($portProperty in $container.NetworkSettings.Ports.PSObject.Properties) {
      foreach ($binding in @($portProperty.Value)) {
        if ($binding -and $binding.HostIp -and $binding.HostIp -ne '127.0.0.1') {
          throw "El contenedor $containerName publica puertos fuera de localhost. Detene solo este proyecto Supabase con 'npm run docker:down' y vuelve a iniciarlo desde esta rama."
        }
      }
    }
  }
}

function Connect-SupabaseContainers {
  param([string]$ProjectId)
  foreach ($containerName in @("supabase_db_$ProjectId", "supabase_kong_$ProjectId")) {
    $running = @(& docker ps --filter "name=^/$containerName$" --format '{{.Names}}' 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $running) {
      throw "No se encontro el contenedor Supabase esperado: $containerName."
    }

    $inspectText = Invoke-CapturedCommand -FilePath 'docker' -Arguments @('inspect', $containerName) -Purpose "Inspeccionar $containerName"
    $container = ($inspectText | ConvertFrom-Json)[0]
    $attached = $container.NetworkSettings.Networks.PSObject.Properties.Name -contains $networkName
    if (-not $attached) {
      [void](Invoke-CapturedCommand -FilePath 'docker' -Arguments @('network', 'connect', $networkName, $containerName) -Purpose "Conectar $containerName a la red compartida")
    }
  }
}

function New-ContainerEnvFiles {
  $rawStatus = Invoke-SupabaseCommand -Arguments @('status', '--output', 'json') -Purpose 'Leer el estado local de Supabase'
  try { $status = $rawStatus | ConvertFrom-Json } catch { throw 'Supabase no devolvio el estado JSON esperado.' }

  $apiUrl = Get-StatusValue -Status $status -Names @('API_URL')
  $dbUrl = Get-StatusValue -Status $status -Names @('DB_URL')
  $anonKey = Get-StatusValue -Status $status -Names @('ANON_KEY', 'PUBLISHABLE_KEY')
  $serviceKey = Get-StatusValue -Status $status -Names @('SERVICE_ROLE_KEY', 'SECRET_KEY')
  if (-not $apiUrl -or -not $dbUrl -or -not $anonKey -or -not $serviceKey) {
    throw 'Faltan URLs o claves de Supabase local en la salida JSON del CLI.'
  }

  $apiUri = [uri]$apiUrl
  if ($apiUri.Port -ne 54321) { throw 'El puerto API local debe ser 54321 para este entorno Docker.' }
  $dbUri = [uri]$dbUrl
  $credentials = [uri]::UnescapeDataString($dbUri.UserInfo)
  $separator = $credentials.IndexOf(':')
  if ($separator -lt 1) { throw 'No se pudieron leer las credenciales locales de PostgreSQL.' }
  $dbUser = $credentials.Substring(0, $separator)
  $dbPassword = $credentials.Substring($separator + 1)
  $dbName = [uri]::UnescapeDataString($dbUri.AbsolutePath.TrimStart('/'))
  $projectId = Get-ProjectId

  $localEnvPath = Join-Path $repoRoot 'Backend\.env.docker.local'
  $publicEnvPath = Join-Path $repoRoot '.env.docker.public'
  Write-EnvFile -Path $localEnvPath -Lines @(
    "SUPABASE_ANON_KEY=$(ConvertTo-EnvValue $anonKey)",
    "SUPABASE_SERVICE_ROLE_KEY=$(ConvertTo-EnvValue $serviceKey)",
    "DB_PASSWORD=$(ConvertTo-EnvValue $dbPassword)"
  )
  Write-EnvFile -Path $publicEnvPath -Lines @(
    'VITE_API_URL=http://localhost:3000',
    'VITE_SUPABASE_URL=http://localhost:54321',
    "VITE_SUPABASE_ANON_KEY=$(ConvertTo-EnvValue $anonKey)",
    'EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321',
    "EXPO_PUBLIC_SUPABASE_ANON_KEY=$(ConvertTo-EnvValue $anonKey)",
    'EXPO_PUBLIC_SUPABASE_LOCAL=true'
  )

  $env:SONDAR_SUPABASE_DB_HOST = "supabase_db_$projectId"
  $env:SONDAR_SUPABASE_KONG_HOST = "supabase_kong_$projectId"
  $env:SONDAR_SUPABASE_DB_USER = $dbUser
  $env:SONDAR_SUPABASE_DB_NAME = $dbName
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'No se encontro Docker CLI. Inicia Docker Desktop e instala Docker Compose.' }
[void](Invoke-CapturedCommand -FilePath 'docker' -Arguments @('info', '--format', '{{.ServerVersion}}') -Purpose 'Consultar Docker Engine')

$projectId = Get-ProjectId
$dbContainer = "supabase_db_$projectId"
$kongContainer = "supabase_kong_$projectId"

switch ($Action) {
  'status' {
    $compose = @(& docker compose --project-directory $repoRoot -f $composeFile ps --format '{{.Name}} {{.State}} {{.Publishers}}' 2>$null)
    if ($LASTEXITCODE -eq 0 -and $compose) { $compose | ForEach-Object { Write-Host $_ } }
    else { Write-Host 'Los servicios web/API/movil de Compose estan detenidos.' }
    $supabase = @(& docker ps --filter "name=^/supabase_.*_$projectId$" --format '{{.Names}} {{.Status}}' 2>$null)
    if ($LASTEXITCODE -eq 0 -and $supabase) { $supabase | ForEach-Object { Write-Host $_ } }
    else { Write-Host 'Supabase local esta detenido.' }
    break
  }
  'down' {
    if (Test-Path -LiteralPath (Join-Path $repoRoot '.env.docker.public')) {
      [void](Invoke-CapturedCommand -FilePath 'docker' -Arguments @('compose', '--project-directory', $repoRoot, '-f', $composeFile, 'down') -Purpose 'Detener los servicios de aplicacion')
    }
    if (-not (Test-Path -LiteralPath $supabaseCli)) { throw 'No se encontro Supabase CLI en node_modules. Ejecuta npm ci en la raiz.' }
    [void](Invoke-SupabaseCommand -Arguments @('stop', '--project-id', $projectId) -Purpose 'Detener Supabase local')
    Write-Host 'Servicios detenidos. Los volumenes y la base local se conservaron.'
    break
  }
  'up' {
    if (-not (Test-Path -LiteralPath $supabaseCli)) { throw 'No se encontro Supabase CLI en node_modules. Ejecuta npm ci en la raiz.' }
    Ensure-SharedNetwork
    $lanIp = $env:SONDAR_LAN_IP
    if (-not $lanIp) { $lanIp = Get-LanIPv4 }
    if ($lanIp -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { throw 'SONDAR_LAN_IP debe contener una dirección IPv4.' }
    $env:SONDAR_LAN_IP = $lanIp

    [void](Invoke-SupabaseCommand -Arguments @('start', '--network-id', $networkName) -Purpose 'Iniciar Supabase local con las migraciones web')
    $bindingFailure = $null
    try {
      Assert-LocalSupabaseBindings -ContainerNames @($dbContainer, $kongContainer)
    } catch {
      $bindingFailure = $_.Exception.Message
    }
    if ($bindingFailure) {
      try {
        [void](Invoke-SupabaseCommand -Arguments @('stop', '--project-id', $projectId) -Purpose 'Detener Supabase con puertos no locales')
      } catch {
        throw "No se pudo confirmar un enlace local seguro ni detener Supabase. Revisa Docker Desktop. Detalle: $bindingFailure"
      }
      throw "Supabase se detuvo y sus volumenes se conservaron porque Docker publico puertos fuera de localhost. Ajusta el bind de Docker antes de volver a ejecutar. Detalle: $bindingFailure"
    }
    Connect-SupabaseContainers -ProjectId $projectId
    [void](Invoke-SupabaseCommand -Arguments @('migration', 'up', '--local') -Purpose 'Aplicar las migraciones web locales pendientes')
    New-ContainerEnvFiles

    $env:SONDAR_EXPO_CLEAR = if ($Clear) { '1' } else { '0' }

    [void](Invoke-CapturedCommand -FilePath 'docker' -Arguments @('compose', '--project-directory', $repoRoot, '-f', $composeFile, 'up', '--detach', '--build') -Purpose 'Construir e iniciar web, API y Metro')
    Write-Host 'Web: http://localhost:3001'
    Write-Host 'API: http://localhost:3000/api/health'
    Write-Host 'Supabase Studio: http://localhost:54323'
    Write-Host "Metro para el dispositivo en LAN: exp://$lanIp`:8081 (ver npm run docker:logs para el QR)"
    Write-Host 'Supabase aplica al iniciar solo las migraciones de esta rama web; la migracion movil de compatibilidad no se copia.'
    break
  }
}
