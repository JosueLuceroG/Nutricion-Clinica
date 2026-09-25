param(
  [string]$InstallRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [string]$DesktopBackupFile,
  [ValidateSet("clean", "emergency")][string]$SnapshotMode = "clean",
  [ValidateSet("clean", "pending", "unknown")][string]$DesktopSyncState = "unknown",
  [string]$SqlCmdPath,
  [switch]$AlreadyStopped
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$paths = Get-StandalonePaths -InstallRoot $InstallRoot
Ensure-StandaloneDirectories -Paths $paths
Import-StandaloneEnvironment -Paths $paths -RequireSecrets | Out-Null
Assert-StandaloneFile -Path $paths.Node
if ($SnapshotMode -eq "clean" -and (-not $DesktopBackupFile -or $DesktopSyncState -ne "clean")) {
  throw "A clean full-install backup requires an exported Desktop backup with clean sync state"
}
if ($DesktopBackupFile -and -not (Test-Path -LiteralPath $DesktopBackupFile -PathType Leaf)) {
  throw "Desktop backup file is missing: $DesktopBackupFile"
}

if (-not $SqlCmdPath) {
  $command = Get-Command sqlcmd.exe -ErrorAction SilentlyContinue
  if ($command) { $SqlCmdPath = $command.Source }
}
if (-not $SqlCmdPath -or -not (Test-Path -LiteralPath $SqlCmdPath -PathType Leaf)) {
  throw "sqlcmd.exe is required for a native SQL Server full-install backup"
}

function SqlIdentifier([string]$value) {
  if (-not $value -or $value -notmatch '^[A-Za-z0-9_.-]{1,128}$') {
    throw "Unsafe SQL database identity"
  }
  return "[$($value.Replace(']', ']]'))]"
}

function SqlLiteral([string]$value) {
  return "N'$($value.Replace("'", "''"))'"
}

function Invoke-BackupSql {
  param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$Query,
    [switch]$Trusted,
    [string]$User,
    [string]$Password
  )
  $arguments = @("-S", $Server, "-d", $Database, "-b", "-r", "1", "-Q", $Query)
  $oldSqlPassword = $env:SQLCMDPASSWORD
  try {
    if ($Trusted) {
      $arguments += "-E"
    } else {
      if (-not $User -or -not $Password) { throw "SQL credentials are not configured" }
      Set-Item -Path "Env:SQLCMDPASSWORD" -Value $Password
      $arguments += @("-U", $User)
    }
    & $SqlCmdPath @arguments 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "SQL backup command failed for $Database" }
  } finally {
    if ($null -eq $oldSqlPassword) { Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue }
    else { Set-Item -Path "Env:SQLCMDPASSWORD" -Value $oldSqlPassword }
  }
}

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$suffix = [guid]::NewGuid().ToString("N").Substring(0, 8)
$destination = Join-Path $paths.BackupRoot "full-install-$stamp-$suffix"
$sqlDestination = Join-Path $destination "sql"
New-Item -ItemType Directory -Path $sqlDestination -Force | Out-Null
$files = [System.Collections.Generic.List[object]]::new()
$components = [System.Collections.Generic.List[object]]::new()
$completed = $false

function Add-HashedFile {
  param(
    [Parameter(Mandatory = $true)][string]$Component,
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter(Mandatory = $true)][string]$RelativePath
  )
  $hash = (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()
  $size = (Get-Item -LiteralPath $File).Length
  $files.Add([pscustomobject]@{
      component = $Component
      relativePath = $RelativePath.Replace("\", "/")
      sizeBytes = [int64]$size
      sha256 = "sha256:$hash"
    })
}

function Copy-ConfiguredTree {
  param(
    [Parameter(Mandatory = $true)][string]$EnvironmentName,
    [Parameter(Mandatory = $true)][string]$ComponentId,
    [Parameter(Mandatory = $true)][string]$BackupSubdirectory
  )
  $entry = Get-Item -Path ("Env:" + $EnvironmentName) -ErrorAction SilentlyContinue
  $source = if ($entry) { [string]$entry.Value } else { "" }
  if (-not $source) {
    $components.Add([pscustomobject]@{ id = $ComponentId; status = "absent" })
    return
  }
  if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "$ComponentId source directory is configured but unavailable"
  }
  $target = Join-Path $destination $BackupSubdirectory
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  $sourceRoot = (Resolve-Path -LiteralPath $source).Path
  $count = 0
  foreach ($item in (Get-ChildItem -LiteralPath $sourceRoot -File -Recurse)) {
    $relative = [IO.Path]::GetRelativePath($sourceRoot, $item.FullName)
    $targetFile = Join-Path $target $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $targetFile) -Force | Out-Null
    Copy-Item -LiteralPath $item.FullName -Destination $targetFile -Force
    Add-HashedFile -Component $ComponentId -File $targetFile -RelativePath ("$BackupSubdirectory/$relative")
    $count++
  }
  $components.Add([pscustomobject]@{ id = $ComponentId; status = "present"; fileCount = $count })
}

$wasRunning = $false
$task = Get-StandaloneTask -Paths $paths
if ($task -and [string]$task.State -eq "Running") { $wasRunning = $true }
try {
  if (-not $AlreadyStopped -and $wasRunning) {
    & (Join-Path $PSScriptRoot "stop.ps1") -InstallRoot $paths.Root
  }

  $oltpDatabase = SqlIdentifier $env:DB_NAME
  $oltpBak = Join-Path $sqlDestination "oltp.bak"
  $oltpQuery = "BACKUP DATABASE $oltpDatabase TO DISK = $(SqlLiteral $oltpBak) WITH INIT, CHECKSUM;"
  Invoke-BackupSql -Server $env:DB_SERVER -Database $env:DB_NAME -Query $oltpQuery `
    -Trusted:($env:DB_TRUSTED -eq "true") -User $env:DB_USER -Password $env:DB_PASSWORD
  Add-HashedFile -Component "oltp.database" -File $oltpBak -RelativePath "sql/oltp.bak"
  $components.Add([pscustomobject]@{ id = "oltp.database"; status = "present" })

  $dwhServer = if ($env:DWH_SERVER) { $env:DWH_SERVER } else { $env:DB_SERVER }
  $dwhDatabase = SqlIdentifier $env:DWH_DATABASE
  $dwhBak = Join-Path $sqlDestination "dwh.bak"
  $dwhQuery = "BACKUP DATABASE $dwhDatabase TO DISK = $(SqlLiteral $dwhBak) WITH INIT, CHECKSUM;"
  $dwhTrusted = if ($env:DWH_TRUSTED) { $env:DWH_TRUSTED } else { $env:DB_TRUSTED }
  $dwhUser = if ($env:DWH_USER) { $env:DWH_USER } else { $env:DB_USER }
  $dwhPassword = if ($env:DWH_PASSWORD) { $env:DWH_PASSWORD } else { $env:DB_PASSWORD }
  Invoke-BackupSql -Server $dwhServer -Database $env:DWH_DATABASE -Query $dwhQuery `
    -Trusted:($dwhTrusted -eq "true") -User $dwhUser -Password $dwhPassword
  Add-HashedFile -Component "dwh.database" -File $dwhBak -RelativePath "sql/dwh.bak"
  $components.Add([pscustomobject]@{ id = "dwh.database"; status = "present" })

  Copy-ConfiguredTree -EnvironmentName "NUTRICLINICA_DOCUMENTS_ROOT" -ComponentId "files.documents" -BackupSubdirectory "files/documents"
  Copy-ConfiguredTree -EnvironmentName "NUTRICLINICA_RECORDINGS_ROOT" -ComponentId "files.telemedicina_recordings" -BackupSubdirectory "files/telemedicina_recordings"

  if ($DesktopBackupFile) {
    $desktopTarget = Join-Path $destination "desktop/local-backup.enc"
    New-Item -ItemType Directory -Path (Split-Path -Parent $desktopTarget) -Force | Out-Null
    Copy-Item -LiteralPath $DesktopBackupFile -Destination $desktopTarget -Force
    Add-HashedFile -Component "desktop.dexie_local_only" -File $desktopTarget -RelativePath "desktop/local-backup.enc"
    $components.Add([pscustomobject]@{ id = "desktop.dexie_local_only"; status = "present" })
  } else {
    $components.Add([pscustomobject]@{ id = "desktop.dexie_local_only"; status = "absent" })
  }

  $memoryStatus = if ($env:AI_MEMORY_ENABLED -eq "true" -and $env:AI_MEMORY_STORE -eq "sql") { "present" } elseif ($env:AI_MEMORY_ENABLED -eq "true") { "ephemeral" } else { "absent" }
  $ragStatus = if ($env:AI_RAG_VERSIONED -eq "true" -and $env:AI_RAG_DOC_STORE -eq "sql") { "present" } elseif ($env:AI_RAG_VERSIONED -eq "true") { "ephemeral" } else { "absent" }
  $telemetryStatus = if ($env:AI_TELEMETRY_STORE -eq "sql") { "present" } else { "ephemeral" }
  $components.Add([pscustomobject]@{ id = "ai.memory"; status = $memoryStatus })
  $components.Add([pscustomobject]@{ id = "rag.knowledge_documents"; status = $ragStatus })
  $components.Add([pscustomobject]@{ id = "observability.telemetry"; status = $telemetryStatus })
  $components.Add([pscustomobject]@{ id = "desktop.sync_outbox"; status = if ($SnapshotMode -eq "clean") { "present" } else { "absent" } })
  $components.Add([pscustomobject]@{ id = "desktop.sync_cursors_and_conflicts"; status = if ($SnapshotMode -eq "clean") { "present" } else { "absent" } })
  $components.Add([pscustomobject]@{ id = "desktop.session_drafts"; status = "absent" })

  $gitCommit = if ($env:GIT_COMMIT -and $env:GIT_COMMIT -match '^[0-9a-fA-F]{40}$') { $env:GIT_COMMIT } else { "UNKNOWN" }
  $createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  $manifestInput = @{
    createdAt = $createdAt
    releaseVersion = if ($env:RELEASE_VERSION) { $env:RELEASE_VERSION } else { "0.0.0-dev" }
    appVersion = if ($env:RELEASE_VERSION) { $env:RELEASE_VERSION } else { "0.0.0-dev" }
    gitCommit = $gitCommit
    instanceId = if ($env:INSTANCE_ID) { $env:INSTANCE_ID } else { "standalone-local" }
    environmentClass = if ($env:ENVIRONMENT_CLASS) { $env:ENVIRONMENT_CLASS } else { "LOCAL" }
    oltpDatabase = $env:DB_NAME
    dwhDatabase = $env:DWH_DATABASE
    snapshotMode = $SnapshotMode
    syncState = if ($SnapshotMode -eq "clean") { "clean" } else { $DesktopSyncState }
    outboxState = if ($SnapshotMode -eq "clean") { "empty" } else { "preserved-or-unverified" }
    files = @($files)
    components = @($components)
  }
  $inputPath = Join-Path $destination "manifest-input.json"
  $manifestPath = Join-Path $destination "manifest.json"
  $manifestInput | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $inputPath -Encoding utf8
  $manifestCli = Join-Path $PSScriptRoot "..\standalone\manifest-cli.mjs"
  Assert-StandaloneFile -Path $manifestCli
  $digestPath = Join-Path $destination "manifest.digest"
  & $paths.Node $manifestCli build --input $inputPath --output $manifestPath --digest-output $digestPath
  if ($LASTEXITCODE -ne 0) { throw "full-install manifest generation failed" }
  Remove-Item -LiteralPath $inputPath -Force
  $completed = $true
  Write-StandaloneLog -Paths $paths -Message "full-install backup created mode=$SnapshotMode"
  Write-Output "Full-install backup created: $destination"
} finally {
  if (-not $completed -and (Test-Path -LiteralPath $destination)) {
    Remove-Item -LiteralPath $destination -Recurse -Force -ErrorAction SilentlyContinue
  }
  if ($wasRunning) {
    & (Join-Path $PSScriptRoot "start.ps1") -InstallRoot $paths.Root
  }
}
