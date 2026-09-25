$ErrorActionPreference = 'Continue'
$sqlcmd = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
$server = 'localhost\SQLEXPRESS'
$pwFile = Join-Path $env:TEMP 'nc_b075_pw.txt'

function Invoke-AdminSql([string]$q) {
  & $sqlcmd -S $server -E -C -b -I -Q $q 2>&1 | Out-String | Write-Output
  if ($LASTEXITCODE -ne 0) { throw "sqlcmd admin fallo: $q" }
}

function Invoke-CiSql([string]$q) {
  & $sqlcmd -S $server -U nc_b075_ci -P $pw -C -b -I -d nc_b075_upgrade -Q $q 2>&1 | Out-String | Write-Output
  if ($LASTEXITCODE -ne 0) { throw "sqlcmd ci fallo: $q" }
}

Write-Output '== 0. limpieza de estado parcial previo'
Invoke-AdminSql "IF DB_ID('nc_b075_fresh') IS NOT NULL BEGIN ALTER DATABASE nc_b075_fresh SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE nc_b075_fresh; END;"
Invoke-AdminSql "IF DB_ID('nc_b075_upgrade') IS NOT NULL BEGIN ALTER DATABASE nc_b075_upgrade SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE nc_b075_upgrade; END;"
Invoke-AdminSql "IF SUSER_ID('nc_b075_ci') IS NOT NULL DROP LOGIN nc_b075_ci;"
if (Test-Path -LiteralPath $pwFile) { Remove-Item -LiteralPath $pwFile -Force }

$pw = [guid]::NewGuid().ToString('N') + 'Xx9'
Set-Content -LiteralPath $pwFile -Value $pw -Encoding ascii

Write-Output '== 1. login + dbs desechables'
Invoke-AdminSql "IF SUSER_ID('nc_b075_ci') IS NULL CREATE LOGIN nc_b075_ci WITH PASSWORD='$pw', CHECK_POLICY=ON, CHECK_EXPIRATION=OFF;"
Invoke-AdminSql "IF DB_ID('nc_b075_fresh') IS NULL CREATE DATABASE nc_b075_fresh;"
Invoke-AdminSql "IF DB_ID('nc_b075_upgrade') IS NULL CREATE DATABASE nc_b075_upgrade;"
Invoke-AdminSql "ALTER AUTHORIZATION ON DATABASE::nc_b075_fresh TO nc_b075_ci;"
Invoke-AdminSql "ALTER AUTHORIZATION ON DATABASE::nc_b075_upgrade TO nc_b075_ci;"

$env:DB_USER = 'nc_b075_ci'; $env:DB_PASSWORD = $pw; $env:DB_SERVER = $server; $env:DB_TRUST_CERT = 'true'

Write-Output '== 2. FRESH: runner aplica 001-037'
$env:DB_NAME = 'nc_b075_fresh'
$out = & pnpm migrate 2>&1 | Out-String
$out | Select-String -Pattern 'resultado|error|fail' | ForEach-Object { $_.Line }
if ($LASTEXITCODE -ne 0) { throw 'migrate fresh fallo' }
if ($out -notmatch 'apply 037-') { throw 'runner no aplico 037 en fresh' }
if ($out -match 'fail |error ') { throw 'migrate fresh reporto errores' }
Write-Output '-- idempotencia fresh (segunda pasada: 0 aplicados)'
$second = & pnpm migrate 2>&1 | Out-String
if ($second -match '(?m)^apply ') { throw "segunda pasada fresh aplico archivos" }
Write-Output '   ok'

Write-Output '== 3. UPGRADE: 001-036 via sqlcmd + checksums, runner solo 037'
$env:DB_NAME = 'nc_b075_upgrade'
$files = Get-ChildItem migrations -Filter '*.sql' | Where-Object { $_.Name -lt '037-' } | Sort-Object Name
$sqlcmdArgs = @('-S', $server, '-U', 'nc_b075_ci', '-P', $pw, '-C', '-b', '-I', '-d', 'nc_b075_upgrade')
foreach ($f in $files) { $sqlcmdArgs += @('-i', $f.FullName) }
& $sqlcmd @sqlcmdArgs 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'aplicacion 001-036 via sqlcmd fallo' }

Write-Output '-- registrar checksums 001-036 (mismo esquema del runner: sha256 CRLF->LF)'
Invoke-CiSql "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'schema_migrations') CREATE TABLE schema_migrations (filename NVARCHAR(255) NOT NULL PRIMARY KEY, applied_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(), checksum NVARCHAR(64) NOT NULL);"
$rows = foreach ($f in $files) {
  $content = [System.IO.File]::ReadAllText($f.FullName)
  $norm = $content -replace "`r`n", "`n"
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($norm)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $hash = ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
  "('$($f.Name)','$hash')"
}
$insert = "INSERT INTO schema_migrations (filename, checksum) VALUES $($rows -join ',');"
Invoke-CiSql $insert
Invoke-CiSql 'SELECT COUNT(*) AS n FROM schema_migrations;'

Write-Output '-- runner sobre 036: debe aplicar SOLO 037'
$up = & pnpm migrate 2>&1 | Out-String
$up | Select-String -Pattern 'apply |resultado|fail|error' | ForEach-Object { $_.Line }
if ($LASTEXITCODE -ne 0) { throw 'migrate upgrade fallo' }
if ($up -notmatch 'apply 037-') { throw 'runner no aplico 037' }
if ($up -match '(?m)^apply (?!037-)') { throw 'runner aplico algo ademas de 037' }
Write-Output '-- segunda pasada: 0 aplicados'
$third = & pnpm migrate 2>&1 | Out-String
if ($third -match '(?m)^apply ') { throw 'tercera pasada aplico archivos' }
Write-Output '   ok'

Write-Output '== 4. verificar tablas 037 en ambas dbs'
foreach ($db in @('nc_b075_fresh', 'nc_b075_upgrade')) {
  $env:DB_NAME = $db
  Invoke-CiSql "SELECT name FROM sys.tables WHERE name IN ('ai_model_deployments','ai_benchmark_runs','ai_org_model_policy') ORDER BY name;"
  $pending = & pnpm migrate 2>&1 | Out-String
  if ($pending -match '(?m)^apply ') { throw "db $db tiene migraciones sin aplicar" }
}

Write-Output '== 5. verificar 037 idempotente (ejecucion directa dos veces sobre fresh)'
& $sqlcmd -S $server -U nc_b075_ci -P $pw -C -b -I -d nc_b075_fresh -i 'migrations\037-build07-5-model-deployments-benchmarks.sql' 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw '037 directo sobre fresh (1a vez) fallo' }
& $sqlcmd -S $server -U nc_b075_ci -P $pw -C -b -I -d nc_b075_fresh -i 'migrations\037-build07-5-model-deployments-benchmarks.sql' 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw '037 directo sobre fresh (2a vez) fallo' }
Write-Output '   ok (IF NOT EXISTS, sin error)'

Write-Output '== 6. limpieza'
Invoke-AdminSql "ALTER DATABASE nc_b075_fresh SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE nc_b075_fresh;"
Invoke-AdminSql "ALTER DATABASE nc_b075_upgrade SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE nc_b075_upgrade;"
Invoke-AdminSql "DROP LOGIN nc_b075_ci;"
Remove-Item -LiteralPath $pwFile -Force
Remove-Item Env:DB_USER, Env:DB_PASSWORD, Env:DB_SERVER, Env:DB_TRUST_CERT, Env:DB_NAME -ErrorAction SilentlyContinue
Write-Output '== VERIFICACION SQL 037 COMPLETA'