param(
  [string]$InstallRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$paths = Get-StandalonePaths -InstallRoot $InstallRoot
$null = Import-StandaloneEnvironment -Paths $paths
$task = Get-StandaloneTask -Paths $paths
$state = Get-StandalonePidState -Paths $paths
$port = if ($env:PORT) { $env:PORT } else { "3000" }
$ready = $false
try {
  $response = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health/ready" -Method Get -TimeoutSec 3
  $ready = $response.status -eq "ready"
} catch {
  $ready = $false
}

[pscustomobject]@{
  taskInstalled = $null -ne $task
  taskState = if ($task) { [string]$task.State } else { "NotInstalled" }
  supervisorRunning = $null -ne $state
  apiReady = $ready
  dataRootConfigured = Test-Path -LiteralPath $paths.DataRoot -PathType Container
  backupRootConfigured = Test-Path -LiteralPath $paths.BackupRoot -PathType Container
  logRootConfigured = Test-Path -LiteralPath $paths.LogRoot -PathType Container
} | ConvertTo-Json -Compress
