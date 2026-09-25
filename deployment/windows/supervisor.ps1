param(
  [string]$InstallRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$paths = Get-StandalonePaths -InstallRoot $InstallRoot
Ensure-StandaloneDirectories -Paths $paths
Assert-StandaloneFile -Path $paths.Node
Assert-StandaloneFile -Path $paths.ApiEntry
Assert-StandaloneFile -Path $paths.JobsEntry
Import-StandaloneEnvironment -Paths $paths -RequireSecrets | Out-Null

Remove-Item -LiteralPath $paths.StopFile -Force -ErrorAction SilentlyContinue
Set-Content -LiteralPath $paths.SupervisorPid -Value "$PID`n" -Encoding utf8

$workers = @(
  [pscustomobject]@{ Name = "api"; Role = "api"; Entry = $paths.ApiEntry; Process = $null; Backoff = 1; StartedAt = $null },
  [pscustomobject]@{ Name = "jobs"; Role = "jobs"; Entry = $paths.JobsEntry; Process = $null; Backoff = 1; StartedAt = $null }
)

function Test-WorkerRunning($worker) {
  if ($null -eq $worker.Process) { return $false }
  try {
    if (-not $worker.Process.HasExited) {
      if ($null -ne $worker.StartedAt -and ((Get-Date) - $worker.StartedAt).TotalSeconds -ge 30) {
        $worker.Backoff = 1
        $worker.StartedAt = $null
      }
      return $true
    }
    $exitCode = $worker.Process.ExitCode
    $worker.Process = $null
    $worker.StartedAt = $null
    $worker.Backoff = [Math]::Min([Math]::Max([int]$worker.Backoff * 2, 2), 30)
    Write-StandaloneLog -Paths $paths -Message "$($worker.Name) exited code=$exitCode; retry=$($worker.Backoff)s"
    return $false
  } catch {
    $worker.Process = $null
    $worker.StartedAt = $null
    $worker.Backoff = [Math]::Min([Math]::Max([int]$worker.Backoff * 2, 2), 30)
    Write-StandaloneLog -Paths $paths -Message "$($worker.Name) exit state unavailable; retry=$($worker.Backoff)s"
    return $false
  }
}

function Start-Worker($worker) {
  $stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
  $stdout = Join-Path $paths.LogRoot "$($worker.Name)-$stamp.out.log"
  $stderr = Join-Path $paths.LogRoot "$($worker.Name)-$stamp.err.log"
  $oldRole = $env:WORKLOAD_ROLE
  $oldBackground = $env:BACKGROUND_JOBS_ENABLED
  try {
    Set-Item -Path "Env:WORKLOAD_ROLE" -Value $worker.Role
    if ($worker.Role -eq "api") { Set-Item -Path "Env:BACKGROUND_JOBS_ENABLED" -Value "false" }
    else { Set-Item -Path "Env:BACKGROUND_JOBS_ENABLED" -Value "true" }
    $worker.Process = Start-Process -FilePath $paths.Node -ArgumentList @($worker.Entry) `
      -WorkingDirectory $paths.ApiRoot -RedirectStandardOutput $stdout `
      -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
    $worker.StartedAt = Get-Date
  } finally {
    if ($null -eq $oldRole) { Remove-Item Env:WORKLOAD_ROLE -ErrorAction SilentlyContinue }
    else { Set-Item -Path "Env:WORKLOAD_ROLE" -Value $oldRole }
    if ($null -eq $oldBackground) { Remove-Item Env:BACKGROUND_JOBS_ENABLED -ErrorAction SilentlyContinue }
    else { Set-Item -Path "Env:BACKGROUND_JOBS_ENABLED" -Value $oldBackground }
  }
  Write-StandaloneLog -Paths $paths -Message "$($worker.Name) started pid=$($worker.Process.Id)"
}

function Stop-Worker($worker) {
  if (-not (Test-WorkerRunning $worker)) { return }
  $pidToStop = $worker.Process.Id
  try {
    Stop-Process -Id $pidToStop -ErrorAction SilentlyContinue
    if (-not $worker.Process.WaitForExit(10000)) {
      Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue
    }
  } catch {
    Write-StandaloneLog -Paths $paths -Message "$($worker.Name) stop failed"
  }
  Write-StandaloneLog -Paths $paths -Message "$($worker.Name) stopped pid=$pidToStop"
  $worker.Process = $null
}

try {
  while (-not (Test-Path -LiteralPath $paths.StopFile)) {
    foreach ($worker in $workers) {
      if (Test-WorkerRunning $worker) { continue }
      if ($worker.Backoff -gt 1) { Start-Sleep -Seconds $worker.Backoff }
      if (Test-Path -LiteralPath $paths.StopFile) { break }
      try {
        Start-Worker $worker
      } catch {
        $worker.Backoff = [Math]::Min($worker.Backoff * 2, 30)
        Write-StandaloneLog -Paths $paths -Message "$($worker.Name) start failed; retry=$($worker.Backoff)s"
      }
    }
    $state = @{
      supervisorPid = $PID
      updatedAt = (Get-Date).ToUniversalTime().ToString("o")
      workers = @($workers | ForEach-Object {
          @{ name = $_.Name; pid = if (Test-WorkerRunning $_) { $_.Process.Id } else { $null }; backoffSeconds = $_.Backoff }
        })
    } | ConvertTo-Json -Depth 4
    Set-Content -LiteralPath $paths.WorkerState -Value $state -Encoding utf8
    Start-Sleep -Seconds 2
  }
} finally {
  foreach ($worker in $workers) { Stop-Worker $worker }
  Remove-Item -LiteralPath $paths.WorkerState -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $paths.SupervisorPid -Force -ErrorAction SilentlyContinue
  foreach ($worker in $workers) { $worker.StartedAt = $null }
  Write-StandaloneLog -Paths $paths -Message "host supervisor stopped"
}
