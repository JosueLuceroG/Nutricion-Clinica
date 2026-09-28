param(
  [Parameter(Mandatory = $true)][string]$BackupPath,
  [Parameter(Mandatory = $true)][string]$RollbackBackupPath,
  [string]$InstallRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [switch]$ConfirmRestore,
  [switch]$RollbackPrepared,
  [switch]$AllowEmergencySnapshot,
  [switch]$AllowDifferentInstance,
  [string]$SqlCmdPath
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

if (-not $ConfirmRestore) { throw "Restore requires -ConfirmRestore" }
if (-not $RollbackPrepared) { throw "Restore requires an independently prepared current-data rollback backup (-RollbackPrepared)" }
if (-not (Test-Path -LiteralPath $BackupPath -PathType Container)) { throw "Backup directory is missing" }
if (-not (Test-Path -LiteralPath $RollbackBackupPath -PathType Container)) { throw "Rollback backup directory is missing" }

$paths = Get-StandalonePaths -InstallRoot $InstallRoot
Ensure-StandaloneDirectories -Paths $paths
Import-StandaloneEnvironment -Paths $paths -RequireSecrets | Out-Null
Assert-StandaloneFile -Path $paths.Node
$manifestCli = Join-Path $PSScriptRoot "..\standalone\manifest-cli.mjs"
Assert-StandaloneFile -Path $manifestCli

function Read-VerifiedBackupManifest {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $root = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path)
  $manifestPath = Join-Path $root "manifest.json"
  $digestPath = Join-Path $root "manifest.digest"
  Assert-StandaloneFile -Path $manifestPath
  Assert-StandaloneFile -Path $digestPath
  $validationOutput = Join-Path $paths.StateRoot "$Label-manifest-validation-$PID.json"
  try {
    & $paths.Node $manifestCli validate --input $manifestPath --output $validationOutput --digest-input $digestPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "$Label manifest validation failed" }
  } finally {
    Remove-Item -LiteralPath $validationOutput -Force -ErrorAction SilentlyContinue
  }
  return [pscustomobject]@{
    Root = $root
    Manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  }
}

$backup = Read-VerifiedBackupManifest -Path $BackupPath -Label "restore-source"
$rollback = Read-VerifiedBackupManifest -Path $RollbackBackupPath -Label "rollback"
if ($backup.Root.Equals($rollback.Root, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Rollback backup must be independent from the restore source"
}
$manifest = $backup.Manifest
if ($manifest.snapshot.mode -eq "emergency" -and -not $AllowEmergencySnapshot) {
  throw "Emergency snapshots require explicit -AllowEmergencySnapshot"
}
if (-not $AllowDifferentInstance -and [string]$manifest.instance.id -ne [string]$env:INSTANCE_ID) {
  throw "Backup instance identity does not match the current host"
}
if ([string]$rollback.Manifest.instance.id -ne [string]$env:INSTANCE_ID) {
  throw "Rollback backup instance identity does not match the current host"
}
if ($rollback.Manifest.snapshot.mode -ne "clean") {
  throw "Rollback backup must be a clean full-install snapshot"
}

function Resolve-BackupFile {
  param(
    [Parameter(Mandatory = $true)][string]$BackupRoot,
    [Parameter(Mandatory = $true)][string]$RelativePath
  )
  $candidate = [IO.Path]::GetFullPath((Join-Path $BackupRoot ($RelativePath.Replace("/", "\"))))
  if (-not $candidate.StartsWith($BackupRoot.TrimEnd("\") + "\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Backup file escapes the backup directory"
  }
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { throw "Backup file is missing" }
  return $candidate
}

function Assert-BackupFileHashes {
  param(
    [Parameter(Mandatory = $true)]$Backup,
    [Parameter(Mandatory = $true)][string]$Label
  )
  foreach ($file in @($Backup.Manifest.files)) {
    $source = Resolve-BackupFile -BackupRoot $Backup.Root -RelativePath ([string]$file.relativePath)
    $actual = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    if ("sha256:$actual" -ne [string]$file.sha256) {
      throw "$Label file checksum mismatch for component $($file.component)"
    }
  }
}
Assert-BackupFileHashes -Backup $backup -Label "Restore source"
Assert-BackupFileHashes -Backup $rollback -Label "Rollback backup"

function Assert-DatabaseBackupEntries {
  param(
    [Parameter(Mandatory = $true)]$Backup,
    [Parameter(Mandatory = $true)][string]$Label
  )
  foreach ($component in @("oltp.database", "dwh.database")) {
    if (-not @($Backup.Manifest.files | Where-Object { $_.component -eq $component })) {
      throw "$Label is missing $component"
    }
  }
}
Assert-DatabaseBackupEntries -Backup $backup -Label "Restore source"
Assert-DatabaseBackupEntries -Backup $rollback -Label "Rollback backup"

if (-not $SqlCmdPath) {
  $command = Get-Command sqlcmd.exe -ErrorAction SilentlyContinue
  if ($command) { $SqlCmdPath = $command.Source }
}
if (-not $SqlCmdPath -or -not (Test-Path -LiteralPath $SqlCmdPath -PathType Leaf)) {
  throw "sqlcmd.exe is required for a native SQL Server restore"
}

function SqlIdentifier([string]$value) {
  if (-not $value -or $value -notmatch '^[A-Za-z0-9_.-]{1,128}$') { throw "Unsafe SQL database identity" }
  return "[$($value.Replace(']', ']]'))]"
}
function SqlLiteral([string]$value) { return "N'$($value.Replace("'", "''"))'" }
function Invoke-RestoreSql {
  param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [switch]$VerifyOnly,
    [switch]$Trusted,
    [string]$User,
    [string]$Password
  )
  $dbIdentifier = SqlIdentifier $Database
  $query = if ($VerifyOnly) {
    "RESTORE VERIFYONLY FROM DISK = $(SqlLiteral $BackupFile) WITH CHECKSUM;"
  } else {
    "ALTER DATABASE $dbIdentifier SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE $dbIdentifier FROM DISK = $(SqlLiteral $BackupFile) WITH REPLACE, RECOVERY; ALTER DATABASE $dbIdentifier SET MULTI_USER;"
  }
  $arguments = @("-S", $Server, "-d", "master", "-b", "-r", "1", "-Q", $query)
  $oldSqlPassword = $env:SQLCMDPASSWORD
  try {
    if ($Trusted) { $arguments += "-E" }
    else {
      if (-not $User -or -not $Password) { throw "SQL credentials are not configured" }
      Set-Item -Path "Env:SQLCMDPASSWORD" -Value $Password
      $arguments += @("-U", $User)
    }
    & $SqlCmdPath @arguments 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "SQL restore command failed for $Database" }
  } finally {
    if ($null -eq $oldSqlPassword) { Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue }
    else { Set-Item -Path "Env:SQLCMDPASSWORD" -Value $oldSqlPassword }
  }
}

$wasRunning = $false
$stopped = $false
$restoreCompleted = $false
$task = Get-StandaloneTask -Paths $paths
if ($task -and [string]$task.State -eq "Running") { $wasRunning = $true }
try {
  $oltpEntry = @($manifest.files | Where-Object { $_.component -eq "oltp.database" })[0]
  $dwhEntry = @($manifest.files | Where-Object { $_.component -eq "dwh.database" })[0]
  if (-not $oltpEntry -or -not $dwhEntry) { throw "Full-install backup must contain OLTP and DWH database backups" }
  $oltpFile = Resolve-BackupFile -BackupRoot $backup.Root -RelativePath ([string]$oltpEntry.relativePath)
  $dwhFile = Resolve-BackupFile -BackupRoot $backup.Root -RelativePath ([string]$dwhEntry.relativePath)
  $dwhServer = if ($env:DWH_SERVER) { $env:DWH_SERVER } else { $env:DB_SERVER }
  $dwhTrusted = if ($env:DWH_TRUSTED) { $env:DWH_TRUSTED } else { $env:DB_TRUSTED }
  $dwhUser = if ($env:DWH_USER) { $env:DWH_USER } else { $env:DB_USER }
  $dwhPassword = if ($env:DWH_PASSWORD) { $env:DWH_PASSWORD } else { $env:DB_PASSWORD }
  Invoke-RestoreSql -Server $env:DB_SERVER -Database $env:DB_NAME -BackupFile $oltpFile `
    -VerifyOnly -Trusted:($env:DB_TRUSTED -eq "true") -User $env:DB_USER -Password $env:DB_PASSWORD
  Invoke-RestoreSql -Server $dwhServer -Database $env:DWH_DATABASE -BackupFile $dwhFile `
    -VerifyOnly -Trusted:($dwhTrusted -eq "true") -User $dwhUser -Password $dwhPassword
  Write-StandaloneLog -Paths $paths -Message "full-install backup verification passed"
  if ($wasRunning) {
    & (Join-Path $PSScriptRoot "stop.ps1") -InstallRoot $paths.Root
    $stopped = $true
  }
  Invoke-RestoreSql -Server $env:DB_SERVER -Database $env:DB_NAME -BackupFile $oltpFile `
    -Trusted:($env:DB_TRUSTED -eq "true") -User $env:DB_USER -Password $env:DB_PASSWORD
  Invoke-RestoreSql -Server $dwhServer -Database $env:DWH_DATABASE -BackupFile $dwhFile `
    -Trusted:($dwhTrusted -eq "true") -User $dwhUser -Password $dwhPassword

  $fileRoots = @{
    "files.documents" = "files/documents"
    "files.telemedicina_recordings" = "files/telemedicina_recordings"
  }
  foreach ($file in @($manifest.files | Where-Object { $_.component -in $fileRoots.Keys })) {
    $source = Resolve-BackupFile -BackupRoot $backup.Root -RelativePath ([string]$file.relativePath)
    $componentPrefix = "$($fileRoots[[string]$file.component])/"
    if (-not ([string]$file.relativePath).StartsWith($componentPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Backup file path does not match component $($file.component)"
    }
    $relative = ([string]$file.relativePath).Substring($componentPrefix.Length).Replace("/", "\")
    $environmentName = if ($file.component -eq "files.documents") { "NUTRICLINICA_DOCUMENTS_ROOT" } else { "NUTRICLINICA_RECORDINGS_ROOT" }
    $entry = Get-Item -Path ("Env:" + $environmentName) -ErrorAction SilentlyContinue
    if (-not $entry -or -not $entry.Value) { throw "Restore target for $($file.component) is not configured" }
    $target = Join-Path ([string]$entry.Value) $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
  }

  $desktopEntry = @($manifest.files | Where-Object { $_.component -eq "desktop.dexie_local_only" })[0]
  if ($desktopEntry) {
    $desktopRestoreRoot = if ($env:NUTRICLINICA_DESKTOP_RESTORE_ROOT) { $env:NUTRICLINICA_DESKTOP_RESTORE_ROOT } else { Join-Path $paths.DataRoot "restore\desktop" }
    New-Item -ItemType Directory -Path $desktopRestoreRoot -Force | Out-Null
    Copy-Item -LiteralPath (Resolve-BackupFile -BackupRoot $backup.Root -RelativePath ([string]$desktopEntry.relativePath)) -Destination (Join-Path $desktopRestoreRoot "local-backup.enc") -Force
    Write-Output "Desktop backup staged for authorized UI import: $desktopRestoreRoot"
  }

  Invoke-StandaloneNode -Paths $paths -Entry $paths.PreflightEntry -Arguments @("--phase=runtime")
  $restoreCompleted = $true
  Write-StandaloneLog -Paths $paths -Message "full-install restore completed"
  Write-Output "Full-install restore completed; Desktop state requires authorized UI import."
} finally {
  if ($stopped) {
    if ($restoreCompleted) {
      & (Join-Path $PSScriptRoot "start.ps1") -InstallRoot $paths.Root
    } else {
      Write-StandaloneLog -Paths $paths -Message "full-install restore failed; host remains stopped"
    }
  }
}
