$ErrorActionPreference = 'Continue'
$sqlcmd = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
$server = 'localhost\SQLEXPRESS'
$pwFile = Join-Path $env:TEMP 'nc_b08_pw.txt'
$oltp = 'nc_b08_oltp'
$dw = 'nc_b08_dw'
$login = 'nc_b08_ci'
$apiDir = Join-Path $PSScriptRoot '..\apps\api'

function Invoke-AdminSql([string]$q) {
  & $sqlcmd -S $server -E -C -b -I -Q $q 2>&1 | Out-String | Write-Output
  if ($LASTEXITCODE -ne 0) { throw "sqlcmd admin fallo: $q" }
}

Write-Output '== BUILD 08 VERIFICACION DWH REAL (nc_b08_oltp + nc_b08_dw) =='

try {
  Write-Output '== 0. limpieza de estado parcial previo'
  Invoke-AdminSql "IF DB_ID('$oltp') IS NOT NULL BEGIN ALTER DATABASE $oltp SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $oltp; END;"
  Invoke-AdminSql "IF DB_ID('$dw') IS NOT NULL BEGIN ALTER DATABASE $dw SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $dw; END;"
  Invoke-AdminSql "IF SUSER_ID('$login') IS NOT NULL DROP LOGIN $login;"
  if (Test-Path -LiteralPath $pwFile) { Remove-Item -LiteralPath $pwFile -Force }

  $pw = [guid]::NewGuid().ToString('N') + 'Xx9'
  Set-Content -LiteralPath $pwFile -Value $pw -Encoding ascii

  Write-Output '== 1. login + bases desechables'
  Invoke-AdminSql "IF SUSER_ID('$login') IS NULL CREATE LOGIN $login WITH PASSWORD='$pw', CHECK_POLICY=ON, CHECK_EXPIRATION=OFF;"
  Invoke-AdminSql "IF DB_ID('$oltp') IS NULL CREATE DATABASE $oltp;"
  Invoke-AdminSql "IF DB_ID('$dw') IS NULL CREATE DATABASE $dw;"
  Invoke-AdminSql "ALTER AUTHORIZATION ON DATABASE::$oltp TO $login;"
  Invoke-AdminSql "ALTER AUTHORIZATION ON DATABASE::$dw TO $login;"

  $env:DB_USER = $login; $env:DB_PASSWORD = $pw; $env:DB_SERVER = $server; $env:DB_TRUST_CERT = 'true'

  Write-Output '== 2. OLTP FRESH: runner aplica 001-039 en nc_b08_oltp'
  $env:DB_NAME = $oltp
  Push-Location $apiDir
  $out = & pnpm migrate 2>&1 | Out-String
  Pop-Location
  $out | Select-String -Pattern 'apply 037|resultado|error|fail' | ForEach-Object { $_.Line }
  if ($LASTEXITCODE -ne 0) { throw 'migrate oltp fallo' }
  if ($out -notmatch 'apply 039-') { throw 'runner no aplico 039 en oltp' }
  if ($out -match 'fail |error ') { throw 'migrate oltp reporto errores' }

  Write-Output '== 3. DWH: schema + fixtures + ETL + metricas + adversarial (vitest real SQL)'
  $env:DWH_DATABASE = $dw
  $env:DWH_ENABLED = 'true'
  $env:DWH_SCHEDULED_LOAD_ENABLED = 'false'
  $env:AI_REAL_SQL_TEST = '1'
  $env:DWH_STORE = 'sql'
  Push-Location $apiDir
  $t = & pnpm vitest run src/modules/dwh/etl.realSql.test.ts --no-color 2>&1 | Out-String
  Pop-Location
  $t | Select-String -Pattern 'Test Files|Tests |FAIL|passed|failed' | ForEach-Object { $_.Line }
  if ($LASTEXITCODE -ne 0) { throw 'vitest real sql fallo' }
  if ($t -match 'FAIL ') { throw 'tests real sql con fallos' }
  if ($t -notmatch 'Tests\s+\d+ passed') { throw 'tests real sql sin resultado claro' }
  Write-Output '-- verificacion SQL real DWH COMPLETA'
}
finally {
  Write-Output '== 4. limpieza'
  Invoke-AdminSql "ALTER DATABASE $oltp SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $oltp;"
  Invoke-AdminSql "ALTER DATABASE $dw SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $dw;"
  Invoke-AdminSql "DROP LOGIN $login;"
  Remove-Item -LiteralPath $pwFile -Force -ErrorAction SilentlyContinue
  Remove-Item Env:DB_USER, Env:DB_PASSWORD, Env:DB_SERVER, Env:DB_TRUST_CERT, Env:DB_NAME, Env:DWH_DATABASE, Env:DWH_ENABLED, Env:DWH_SCHEDULED_LOAD_ENABLED, Env:AI_REAL_SQL_TEST, Env:DWH_STORE -ErrorAction SilentlyContinue
}
