param(
  [string]$InstallRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [switch]$Force
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$paths = Get-StandalonePaths -InstallRoot $InstallRoot
Ensure-StandaloneDirectories -Paths $paths
Set-Content -LiteralPath $paths.StopFile -Value "requested" -Encoding utf8
Write-StandaloneLog -Paths $paths -Message "stop requested"

$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline -and (Test-Path -LiteralPath $paths.SupervisorPid)) {
  Start-Sleep -Seconds 1
}

if (Test-Path -LiteralPath $paths.SupervisorPid) {
  if (-not $Force) {
    throw "host supervisor did not stop within 30 seconds; rerun with -Force"
  }
  $state = Get-StandalonePidState -Paths $paths
  if ($state) {
    foreach ($worker in @($state.workers)) {
      if ($worker.pid) { Stop-Process -Id ([int]$worker.pid) -Force -ErrorAction SilentlyContinue }
    }
    if ($state.supervisorPid) { Stop-Process -Id ([int]$state.supervisorPid) -Force -ErrorAction SilentlyContinue }
  }
}
Write-Output "NutriClinica standalone stopped."
