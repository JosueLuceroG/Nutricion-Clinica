param(
  [string]$InstallRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)
$ErrorActionPreference = "Stop"
$stop = Join-Path $PSScriptRoot "stop.ps1"
$start = Join-Path $PSScriptRoot "start.ps1"
& $stop -InstallRoot $InstallRoot
& $start -InstallRoot $InstallRoot
Write-Output "NutriClinica standalone restart requested."
