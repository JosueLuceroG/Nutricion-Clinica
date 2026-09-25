Set-StrictMode -Version Latest

function Resolve-StandaloneRoot {
  param([Parameter(Mandatory = $true)][string]$InstallRoot)

  if (-not (Test-Path -LiteralPath $InstallRoot)) {
    throw "Standalone install root does not exist: $InstallRoot"
  }
  return (Resolve-Path -LiteralPath $InstallRoot).Path
}

function Get-StandalonePaths {
  param([Parameter(Mandatory = $true)][string]$InstallRoot)

  $root = Resolve-StandaloneRoot -InstallRoot $InstallRoot
  $configured = @{}
  $configPath = Join-Path $root "config\standalone.env"
  if (Test-Path -LiteralPath $configPath -PathType Leaf) {
    $configured = Read-StandaloneEnvFile -Path $configPath
  }
  $dataRoot = if ($configured.ContainsKey("NUTRICLINICA_DATA_ROOT")) {
    $configured["NUTRICLINICA_DATA_ROOT"]
  } elseif ($env:NUTRICLINICA_DATA_ROOT) {
    $env:NUTRICLINICA_DATA_ROOT
  } else {
    Join-Path ($env:ProgramData ?? "C:\\ProgramData") "NutriClinica"
  }
  $backupRoot = if ($configured.ContainsKey("NUTRICLINICA_BACKUP_ROOT")) {
    $configured["NUTRICLINICA_BACKUP_ROOT"]
  } elseif ($env:NUTRICLINICA_BACKUP_ROOT) {
    $env:NUTRICLINICA_BACKUP_ROOT
  } else {
    Join-Path $dataRoot "backups"
  }
  $logRoot = if ($configured.ContainsKey("NUTRICLINICA_LOG_ROOT")) {
    $configured["NUTRICLINICA_LOG_ROOT"]
  } elseif ($env:NUTRICLINICA_LOG_ROOT) {
    $env:NUTRICLINICA_LOG_ROOT
  } else {
    Join-Path $dataRoot "logs"
  }
  $webRoot = if ($configured.ContainsKey("NUTRICLINICA_WEB_ROOT")) {
    $configured["NUTRICLINICA_WEB_ROOT"]
  } elseif ($env:NUTRICLINICA_WEB_ROOT) {
    $env:NUTRICLINICA_WEB_ROOT
  } else {
    Join-Path $root "web"
  }

  return [pscustomobject]@{
    Root = $root
    Node = Join-Path $root "runtime\node.exe"
    ApiRoot = Join-Path $root "api"
    ApiEntry = Join-Path $root "api\server.js"
    JobsEntry = Join-Path $root "api\jobs.js"
    MigrateEntry = Join-Path $root "api\migrate.js"
    DwhSchemaEntry = Join-Path $root "api\dwh-schema.js"
    PreflightEntry = Join-Path $root "api\standalone-preflight.js"
    WebRoot = $webRoot
    ConfigRoot = Join-Path $root "config"
    EnvFile = Join-Path $root "config\standalone.env"
    SecretsFile = Join-Path $root "config\server-secrets.env"
    DataRoot = $dataRoot
    BackupRoot = $backupRoot
    LogRoot = $logRoot
    StateRoot = Join-Path $dataRoot "state"
    StopFile = Join-Path $dataRoot "state\stop.requested"
    SupervisorPid = Join-Path $dataRoot "state\supervisor.pid"
    WorkerState = Join-Path $dataRoot "state\workers.json"
    TaskName = "NutriClinicaHost"
  }
}

function Read-StandaloneEnvFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Required standalone environment file is missing: $Path"
  }
  $values = @{}
  $lineNumber = 0
  foreach ($rawLine in (Get-Content -LiteralPath $Path -ErrorAction Stop)) {
    $lineNumber++
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) { continue }
    $match = [regex]::Match($line, '^([A-Z][A-Z0-9_]*)=(.*)$')
    if (-not $match.Success) {
      throw "Invalid standalone env syntax at line $lineNumber"
    }
    $key = $match.Groups[1].Value
    if ($values.ContainsKey($key)) {
      throw "Duplicate standalone env key: $key"
    }
    $value = $match.Groups[2].Value.Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$key] = $value
  }
  return $values
}

function Test-StandaloneSecretKey {
  param([Parameter(Mandatory = $true)][string]$Key)

  return [regex]::IsMatch(
    $Key,
    '(?i)(PASSWORD|SECRET|TOKEN|CREDENTIAL|API[_-]?KEY|PRIVATE[_-]?KEY|ENCRYPTION[_-]?KEY|(?:DB|DWH|SMTP)(?:_TRUSTED)?_USER$)'
  )
}

function Assert-StandaloneNonSecretConfiguration {
  param([Parameter(Mandatory = $true)][hashtable]$Values)

  foreach ($key in $Values.Keys) {
    if (Test-StandaloneSecretKey -Key ([string]$key)) {
      throw "Secret-shaped key $key must be placed in the protected server secret file"
    }
  }
}

function Assert-StandaloneSecretConfiguration {
  param([Parameter(Mandatory = $true)][hashtable]$Values)

  foreach ($key in $Values.Keys) {
    if (-not (Test-StandaloneSecretKey -Key ([string]$key))) {
      throw "Non-secret key $key must be placed in standalone.env"
    }
  }
}

function Initialize-StandaloneConfiguration {
  param(
    [Parameter(Mandatory = $true)]$Paths,
    [string]$ConfigFile
  )

  if ($ConfigFile) {
    if (-not (Test-Path -LiteralPath $ConfigFile -PathType Leaf)) {
      throw "Configuration source file is missing: $ConfigFile"
    }
    $sourceValues = Read-StandaloneEnvFile -Path $ConfigFile
    Assert-StandaloneNonSecretConfiguration -Values $sourceValues
    Copy-Item -LiteralPath $ConfigFile -Destination $Paths.EnvFile -Force
    return
  }

  if (Test-Path -LiteralPath $Paths.EnvFile -PathType Leaf) {
    Assert-StandaloneNonSecretConfiguration -Values (Read-StandaloneEnvFile -Path $Paths.EnvFile)
    return
  } else {
    $template = Join-Path $Paths.ConfigRoot "standalone.env.example"
    if (-not (Test-Path -LiteralPath $template -PathType Leaf)) {
      $template = Join-Path $PSScriptRoot "standalone.env.example"
    }
    if (-not (Test-Path -LiteralPath $template -PathType Leaf)) {
      throw "Standalone environment template is missing: $template"
    }
    $content = Get-Content -LiteralPath $template -Raw -ErrorAction Stop
    $content = [regex]::Replace($content, '(?m)^NUTRICLINICA_DATA_ROOT=.*$', "NUTRICLINICA_DATA_ROOT=$($Paths.DataRoot)")
    $content = [regex]::Replace($content, '(?m)^NUTRICLINICA_BACKUP_ROOT=.*$', "NUTRICLINICA_BACKUP_ROOT=$($Paths.BackupRoot)")
    $content = [regex]::Replace($content, '(?m)^NUTRICLINICA_LOG_ROOT=.*$', "NUTRICLINICA_LOG_ROOT=$($Paths.LogRoot)")
    $content = [regex]::Replace($content, '(?m)^NUTRICLINICA_WEB_ROOT=.*$', "NUTRICLINICA_WEB_ROOT=$(Join-Path $Paths.Root 'web')")
    Set-Content -LiteralPath $Paths.EnvFile -Value $content -Encoding utf8
  }

  Assert-StandaloneNonSecretConfiguration -Values (Read-StandaloneEnvFile -Path $Paths.EnvFile)
}

function Import-StandaloneEnvironment {
  param(
    [Parameter(Mandatory = $true)]$Paths,
    [switch]$RequireSecrets
  )

  $values = Read-StandaloneEnvFile -Path $Paths.EnvFile
  Assert-StandaloneNonSecretConfiguration -Values $values
  if (Test-Path -LiteralPath $Paths.SecretsFile) {
    $secretValues = Read-StandaloneEnvFile -Path $Paths.SecretsFile
    Assert-StandaloneSecretConfiguration -Values $secretValues
    foreach ($entry in $secretValues.GetEnumerator()) {
      if ($values.ContainsKey($entry.Key)) {
        throw "Duplicate standalone environment key: $($entry.Key)"
      }
      $values[$entry.Key] = $entry.Value
    }
  } elseif ($RequireSecrets) {
    throw "Protected server secret file is missing: $($Paths.SecretsFile)"
  }

  foreach ($entry in $values.GetEnumerator()) {
    Set-Item -Path ("Env:" + $entry.Key) -Value ([string]$entry.Value)
  }

  Set-Item -Path "Env:STANDALONE_MODE" -Value "true"
  if (-not $env:ENVIRONMENT_CLASS) { Set-Item -Path "Env:ENVIRONMENT_CLASS" -Value "LOCAL" }
  Set-Item -Path "Env:NUTRICLINICA_DATA_ROOT" -Value $Paths.DataRoot
  Set-Item -Path "Env:NUTRICLINICA_BACKUP_ROOT" -Value $Paths.BackupRoot
  Set-Item -Path "Env:NUTRICLINICA_LOG_ROOT" -Value $Paths.LogRoot
  Set-Item -Path "Env:NUTRICLINICA_WEB_ROOT" -Value $Paths.WebRoot
  return $values
}

function Assert-StandaloneFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Standalone artifact is missing: $Path"
  }
}

function Ensure-StandaloneDirectories {
  param([Parameter(Mandatory = $true)]$Paths)
  foreach ($path in @($Paths.ConfigRoot, $Paths.DataRoot, $Paths.BackupRoot, $Paths.LogRoot, $Paths.StateRoot)) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
  }
}

function Protect-StandaloneSecrets {
  param([Parameter(Mandatory = $true)]$Paths)
  if (-not (Test-Path -LiteralPath $Paths.SecretsFile -PathType Leaf)) {
    throw "Protected server secret file is missing: $($Paths.SecretsFile)"
  }
  & icacls.exe $Paths.SecretsFile /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Unable to protect the server secret file" }
}

function Write-StandaloneLog {
  param(
    [Parameter(Mandatory = $true)]$Paths,
    [Parameter(Mandatory = $true)][string]$Message
  )
  New-Item -ItemType Directory -Path $Paths.LogRoot -Force | Out-Null
  $line = "{0} {1}" -f (Get-Date).ToUniversalTime().ToString("o"), $Message
  Add-Content -LiteralPath (Join-Path $Paths.LogRoot "host-supervisor.log") -Value $line
}

function Invoke-StandaloneNode {
  param(
    [Parameter(Mandatory = $true)]$Paths,
    [Parameter(Mandatory = $true)][string]$Entry,
    [string[]]$Arguments = @(),
    [string]$WorkloadRole = ""
  )
  Assert-StandaloneFile -Path $Paths.Node
  Assert-StandaloneFile -Path $Entry
  $previousRole = $env:WORKLOAD_ROLE
  try {
    if ($WorkloadRole) { Set-Item -Path "Env:WORKLOAD_ROLE" -Value $WorkloadRole }
    & $Paths.Node $Entry @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Standalone node workload failed: $([IO.Path]::GetFileName($Entry)) exit=$LASTEXITCODE"
    }
  } finally {
    if ($null -eq $previousRole) {
      Remove-Item -Path Env:WORKLOAD_ROLE -ErrorAction SilentlyContinue
    } else {
      Set-Item -Path "Env:WORKLOAD_ROLE" -Value $previousRole
    }
  }
}

function Get-StandaloneTask {
  param([Parameter(Mandatory = $true)]$Paths)
  try {
    return Get-ScheduledTask -TaskName $Paths.TaskName -ErrorAction Stop
  } catch {
    return $null
  }
}

function Get-StandalonePidState {
  param([Parameter(Mandatory = $true)]$Paths)
  if (-not (Test-Path -LiteralPath $Paths.WorkerState)) { return $null }
  try {
    $state = Get-Content -LiteralPath $Paths.WorkerState -Raw | ConvertFrom-Json
    if (-not $state.supervisorPid) { return $null }
    $supervisor = Get-Process -Id ([int]$state.supervisorPid) -ErrorAction Stop
    if ($supervisor.HasExited) { return $null }
    return $state
  } catch {
    return $null
  }
}
