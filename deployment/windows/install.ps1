param(
  [string]$InstallRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [string]$ConfigFile,
  [string]$SecretFile,
  [switch]$StartAfterInstall
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$paths = Get-StandalonePaths -InstallRoot $InstallRoot
Ensure-StandaloneDirectories -Paths $paths
Initialize-StandaloneConfiguration -Paths $paths -ConfigFile $ConfigFile
$paths = Get-StandalonePaths -InstallRoot $InstallRoot
Ensure-StandaloneDirectories -Paths $paths
Assert-StandaloneFile -Path $paths.Node
Assert-StandaloneFile -Path $paths.ApiEntry
Assert-StandaloneFile -Path $paths.JobsEntry
Assert-StandaloneFile -Path $paths.MigrateEntry
Assert-StandaloneFile -Path $paths.DwhSchemaEntry
Assert-StandaloneFile -Path $paths.PreflightEntry
if (-not (Test-Path -LiteralPath $paths.WebRoot -PathType Container)) {
  throw "Web artifact directory is missing: $($paths.WebRoot)"
}

if ($SecretFile) {
  if (-not (Test-Path -LiteralPath $SecretFile -PathType Leaf)) {
    throw "Secret source file is missing: $SecretFile"
  }
  Copy-Item -LiteralPath $SecretFile -Destination $paths.SecretsFile -Force
}
Protect-StandaloneSecrets -Paths $paths
Import-StandaloneEnvironment -Paths $paths -RequireSecrets | Out-Null

Write-StandaloneLog -Paths $paths -Message "install preflight started"
Invoke-StandaloneNode -Paths $paths -Entry $paths.PreflightEntry -Arguments @("--phase=install")
Invoke-StandaloneNode -Paths $paths -Entry $paths.MigrateEntry -WorkloadRole "migration"
Invoke-StandaloneNode -Paths $paths -Entry $paths.DwhSchemaEntry -WorkloadRole "dwh-schema"
Invoke-StandaloneNode -Paths $paths -Entry $paths.PreflightEntry -Arguments @("--phase=runtime")

$supervisor = Join-Path $PSScriptRoot "supervisor.ps1"
$pwsh = Get-Command pwsh.exe -ErrorAction SilentlyContinue
if (-not $pwsh) { throw "PowerShell 7 (pwsh.exe) is required for the standalone host supervisor" }
$taskCommand = "`"$($pwsh.Source)`" -NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$supervisor`" -InstallRoot `"$($paths.Root)`""
& schtasks.exe /Create /TN $paths.TaskName /SC ONSTART /DELAY 0001:00 /RU SYSTEM /RL HIGHEST /TR $taskCommand /F | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Unable to register the Windows host task" }

Write-StandaloneLog -Paths $paths -Message "install completed task=$($paths.TaskName)"
if ($StartAfterInstall) {
  & (Join-Path $PSScriptRoot "start.ps1") -InstallRoot $paths.Root
}
Write-Output "NutriClinica standalone installed. Data and backups remain outside the application uninstall boundary."
