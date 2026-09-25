param(
  [string]$InstallRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [switch]$RemoveApplicationFiles
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$paths = Get-StandalonePaths -InstallRoot $InstallRoot
$stop = Join-Path $PSScriptRoot "stop.ps1"
if (Get-StandaloneTask -Paths $paths) {
  & $stop -InstallRoot $paths.Root -Force
  Unregister-ScheduledTask -TaskName $paths.TaskName -Confirm:$false
}

# Deliberately never remove DataRoot, BackupRoot or LogRoot.
if ($RemoveApplicationFiles) {
  foreach ($path in @($paths.ApiRoot, $paths.WebRoot, (Join-Path $paths.Root "runtime"))) {
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Recurse -Force }
  }
}
Write-Output "NutriClinica host uninstalled. Clinical data, backups and logs were retained."
