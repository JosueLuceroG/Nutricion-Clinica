param(
  [string]$RepositoryRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [string]$OutputRoot = "",
  [Parameter(Mandatory = $true)][string]$NodeRuntimePath
)
$ErrorActionPreference = "Stop"

$repo = (Resolve-Path -LiteralPath $RepositoryRoot).Path
if (-not $OutputRoot) { $OutputRoot = Join-Path $repo "dist-standalone-package" }
$output = [IO.Path]::GetFullPath($OutputRoot)
if (-not (Test-Path -LiteralPath $NodeRuntimePath -PathType Leaf)) { throw "Node runtime is missing" }
$outputRelative = [IO.Path]::GetRelativePath($repo, $output).Replace("/", "\")
if ($outputRelative -eq ".." -or $outputRelative.StartsWith("..\", [StringComparison]::Ordinal)) {
  throw "OutputRoot must be inside RepositoryRoot so the production dependency links remain portable"
}
$repoWithoutSlash = $repo.TrimEnd("\", "/")
if ($output.Equals($repoWithoutSlash, [StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputRoot cannot be the repository root"
}
$webBuildRoot = [IO.Path]::GetFullPath((Join-Path $repo "dist"))
$webBuildPrefix = $webBuildRoot.TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar
if ($output.Equals($webBuildRoot, [StringComparison]::OrdinalIgnoreCase) -or
    $output.StartsWith($webBuildPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputRoot cannot overlap the Web dist directory"
}
if (Test-Path -LiteralPath $output) {
  $existingOutput = Get-Item -LiteralPath $output -Force
  if (($existingOutput.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "OutputRoot cannot be a junction or symbolic link"
  }
}
$apiOutputRelative = Join-Path $outputRelative "api"

$nodeVersion = & $NodeRuntimePath --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(2[0-9]|[3-9][0-9])\.') {
  throw "The packaged Node runtime must be Node 20 or newer"
}

Push-Location $repo
try {
  $oldBuildCi = $env:CI
  try {
    Set-Item Env:CI -Value "true"
    & pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "Workspace dependency preparation failed" }
  } finally {
    if ($null -eq $oldBuildCi) { Remove-Item Env:CI -ErrorAction SilentlyContinue } else { Set-Item Env:CI -Value $oldBuildCi }
  }
  & pnpm --dir apps/api build:deploy
  if ($LASTEXITCODE -ne 0) { throw "API deployment artifact build failed" }
  $apiSourceManifest = Get-Content -LiteralPath (Join-Path $repo "apps\api\package.json") -Raw | ConvertFrom-Json
  $oldCi = $env:CI
  $oldApiUrl = $env:VITE_API_URL
  try {
    Set-Item Env:CI -Value "true"
    Set-Item Env:VITE_API_URL -Value "/api"
    & pnpm build
    if ($LASTEXITCODE -ne 0) { throw "Web artifact build failed" }
  } finally {
    if ($null -eq $oldCi) { Remove-Item Env:CI -ErrorAction SilentlyContinue } else { Set-Item Env:CI -Value $oldCi }
    if ($null -eq $oldApiUrl) { Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue } else { Set-Item Env:VITE_API_URL -Value $oldApiUrl }
  }

  if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Recurse -Force }
  New-Item -ItemType Directory -Path $output -Force | Out-Null

  # Injected workspace deployment scopes the tree to the API and hoisted
  # linking keeps the moved package free of absolute junctions.
  & pnpm --filter "@nutriclinica/api" deploy --prod --ignore-scripts --config.inject-workspace-packages=true --config.node-linker=hoisted $apiOutputRelative
  if ($LASTEXITCODE -ne 0) { throw "API production dependency deployment failed" }

  $apiOutput = Join-Path $output "api"
  $apiBundle = Join-Path $apiOutput "dist-deploy"
  if (-not (Test-Path -LiteralPath (Join-Path $apiOutput "package.json") -PathType Leaf)) {
    throw "API production package metadata is missing"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $apiOutput "node_modules") -PathType Container)) {
    throw "API production dependencies are missing"
  }
  if (-not (Test-Path -LiteralPath $apiBundle -PathType Container)) {
    throw "API deployment artifact is missing from the production package"
  }
  Copy-Item -Path (Join-Path $apiBundle "*") -Destination $apiOutput -Recurse -Force
  Remove-Item -LiteralPath $apiBundle -Recurse -Force
  foreach ($unneeded in @("src", "scripts-tmp", "Dockerfile", "README.md", "tsconfig.json", "vitest.config.ts", ".env.example")) {
    $unneededPath = Join-Path $apiOutput $unneeded
    if (Test-Path -LiteralPath $unneededPath) { Remove-Item -LiteralPath $unneededPath -Recurse -Force }
  }
  $runtimeDependencies = [ordered]@{}
  foreach ($dependency in $apiSourceManifest.dependencies.psobject.Properties) {
    if ($dependency.Name -ne "@nutriclinica/shared") {
      $runtimeDependencies[$dependency.Name] = [string]$dependency.Value
    }
  }
  $runtimeScripts = [ordered]@{
    start = "node server.js"
    "start:jobs" = "node jobs.js"
    "start:migrate" = "node migrate.js"
    "start:dwh-schema" = "node dwh-schema.js"
    "start:retention-backfill" = "node retention-backfill.js"
  }
  [ordered]@{
    name = [string]$apiSourceManifest.name
    version = [string]$apiSourceManifest.version
    private = $true
    type = [string]$apiSourceManifest.type
    main = "server.js"
    description = [string]$apiSourceManifest.description
    engines = [ordered]@{ node = [string]$apiSourceManifest.engines.node }
    scripts = $runtimeScripts
    dependencies = $runtimeDependencies
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $apiOutput "package.json") -Encoding utf8
  foreach ($metadata in @(
      (Join-Path $apiOutput "pnpm-lock.yaml"),
      (Join-Path $apiOutput "node_modules\.modules.yaml"),
      (Join-Path $apiOutput "node_modules\.pnpm"),
      (Join-Path $apiOutput "node_modules\.bin")
    )) {
    if (Test-Path -LiteralPath $metadata) { Remove-Item -LiteralPath $metadata -Recurse -Force }
  }
  $sharedPackage = Join-Path $apiOutput "node_modules\@nutriclinica\shared"
  if (Test-Path -LiteralPath $sharedPackage) { Remove-Item -LiteralPath $sharedPackage -Recurse -Force }
  $sharedScope = Join-Path $apiOutput "node_modules\@nutriclinica"
  if ((Test-Path -LiteralPath $sharedScope -PathType Container) -and -not (Get-ChildItem -LiteralPath $sharedScope -Force)) {
    Remove-Item -LiteralPath $sharedScope -Recurse -Force
  }
  Get-ChildItem -LiteralPath (Join-Path $apiOutput "node_modules") -File -Recurse -Filter "*.map" | Remove-Item -Force
  if (-not (Test-Path -LiteralPath (Join-Path $apiOutput "node_modules\express") -PathType Container)) {
    throw "API production dependencies are missing"
  }
  Push-Location $apiOutput
  try {
    & $NodeRuntimePath --input-type=module -e "for (const name of ['express','argon2','mssql','dotenv','ws']) await import(name)"
    if ($LASTEXITCODE -ne 0) { throw "Packaged API dependencies failed to load" }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

foreach ($directory in @("web", "runtime", "config", "deployment\windows", "deployment\standalone")) {
  New-Item -ItemType Directory -Path (Join-Path $output $directory) -Force | Out-Null
}
foreach ($webEntry in (Get-ChildItem -LiteralPath (Join-Path $repo "dist") -Force)) {
  if ([IO.Path]::GetFullPath($webEntry.FullName).Equals($output, [StringComparison]::OrdinalIgnoreCase)) { continue }
  Copy-Item -LiteralPath $webEntry.FullName -Destination (Join-Path $output "web") -Recurse -Force
}
Copy-Item -LiteralPath $NodeRuntimePath -Destination (Join-Path $output "runtime\node.exe") -Force
Copy-Item -Path (Join-Path $repo "deployment\windows\*") -Destination (Join-Path $output "deployment\windows") -Recurse -Force
Copy-Item -Path (Join-Path $repo "deployment\standalone\*") -Destination (Join-Path $output "deployment\standalone") -Recurse -Force

Copy-Item -LiteralPath (Join-Path $repo "deployment\windows\standalone.env.example") -Destination (Join-Path $output "config\standalone.env.example") -Force
Copy-Item -LiteralPath (Join-Path $repo "deployment\windows\server-secrets.env.example") -Destination (Join-Path $output "config\server-secrets.env.example") -Force

$forbidden = Get-ChildItem -LiteralPath $output -File -Recurse | Where-Object {
  (($_.Name -match '^\.env($|\.)' -or $_.Name -match '\.env$') -and $_.Name -notmatch '\.example$') -or $_.Extension -eq '.map'
}
if ($forbidden) { throw "Standalone package contains a forbidden env or source-map artifact" }

$packageFiles = Get-ChildItem -LiteralPath $output -File -Recurse | ForEach-Object {
  $relative = [IO.Path]::GetRelativePath($output, $_.FullName).Replace("\", "/")
  [pscustomobject]@{
    path = $relative
    sizeBytes = [int64]$_.Length
    sha256 = "sha256:$((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant())"
  }
}
@{
  format = "nutriclinica-standalone-package-v1"
  createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  nodeVersion = [string]$nodeVersion
  files = @($packageFiles)
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $output "package-manifest.json") -Encoding utf8

Write-Output "Standalone package created: $output"
