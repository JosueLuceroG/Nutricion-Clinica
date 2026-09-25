param(
  [string]$InstallRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$paths = Get-StandalonePaths -InstallRoot $InstallRoot
Ensure-StandaloneDirectories -Paths $paths
Remove-Item -LiteralPath $paths.StopFile -Force -ErrorAction SilentlyContinue
$task = Get-StandaloneTask -Paths $paths
if ($null -eq $task) { throw "NutriClinica host task is not installed" }
Start-ScheduledTask -TaskName $paths.TaskName
Write-StandaloneLog -Paths $paths -Message "start requested"
Write-Output "NutriClinica standalone start requested. Use status.ps1 for readiness."
