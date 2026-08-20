$ErrorActionPreference = 'Continue'
param(
  # Directorio donde SQL Server puede escribir el .bak (si falla con permiso,
  # pasa -BackupDir a una ruta accesible por el servicio de SQL Server).
  [string]$BackupDir = (Join-Path $env:TEMP 'nc_b09_5a_backup')
)
$sqlcmd = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
$server = 'localhost\SQLEXPRESS'
$pwFile = Join-Path $env:TEMP 'nc_b09_5a_pw.txt'
$oltp = 'nc_b09_oltp'
$restoreDb = 'nc_b09_5a_restore'
$dw = 'nc_b09_dw'
$login = 'nc_b09_5a_ci'
$apiDir = Join-Path $PSScriptRoot '..\apps\api'
$bak = Join-Path $BackupDir 'nc_b09_oltp.bak'

function Invoke-AdminSql([string]$q) {
  & $sqlcmd -S $server -E -C -b -I -Q $q 2>&1 | Out-String | Write-Output
  if ($LASTEXITCODE -ne 0) { throw "sqlcmd admin fallo: $q" }
}

Write-Output '== BUILD 09.5A VERIFICACION DESPLIEGUE + PERSISTENCIA (migracion 039, backup/restore, DWH) =='
Write-Output "BackupDir: $BackupDir (ajustar con -BackupDir si SQL Server no puede escribir ahi)"

try {
  Write-Output '== 0. limpieza de estado parcial previo'
  Invoke-AdminSql "IF DB_ID('$oltp') IS NOT NULL BEGIN ALTER DATABASE $oltp SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $oltp; END;"
  Invoke-AdminSql "IF DB_ID('$restoreDb') IS NOT NULL BEGIN ALTER DATABASE $restoreDb SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $restoreDb; END;"
  Invoke-AdminSql "IF DB_ID('$dw') IS NOT NULL BEGIN ALTER DATABASE $dw SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $dw; END;"
  Invoke-AdminSql "IF SUSER_ID('$login') IS NOT NULL DROP LOGIN $login;"
  if (Test-Path -LiteralPath $pwFile) { Remove-Item -LiteralPath $pwFile -Force }
  if (Test-Path -LiteralPath $BackupDir) { Remove-Item -LiteralPath $BackupDir -Recurse -Force }
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

  $pw = [guid]::NewGuid().ToString('N') + 'Xx9'
  Set-Content -LiteralPath $pwFile -Value $pw -Encoding ascii

  Write-Output '== 1. login + bases desechables'
  Invoke-AdminSql "IF SUSER_ID('$login') IS NULL CREATE LOGIN $login WITH PASSWORD='$pw', CHECK_POLICY=ON, CHECK_EXPIRATION=OFF;"
  Invoke-AdminSql "IF DB_ID('$oltp') IS NULL CREATE DATABASE $oltp;"
  Invoke-AdminSql "IF DB_ID('$dw') IS NULL CREATE DATABASE $dw;"
  Invoke-AdminSql "ALTER AUTHORIZATION ON DATABASE::$oltp TO $login;"
  Invoke-AdminSql "ALTER AUTHORIZATION ON DATABASE::$dw TO $login;"

  $env:DB_USER = $login; $env:DB_PASSWORD = $pw; $env:DB_SERVER = $server; $env:DB_TRUST_CERT = 'true'

  Write-Output '== 2. OLTP FRESH: runner aplica 001-039 en nc_b09_oltp (target guard fail-closed activo)'
  $env:DB_NAME = $oltp
  Push-Location $apiDir
  $out = & pnpm migrate 2>&1 | Out-String
  Pop-Location
  $out | Select-String -Pattern 'apply 039|resultado|error|fail|guard' | ForEach-Object { $_.Line }
  if ($LASTEXITCODE -ne 0) { throw 'migrate oltp fallo' }
  if ($out -notmatch 'apply 039-') { throw 'runner no aplico 039 en oltp' }
  if ($out -match 'fail |error ') { throw 'migrate oltp reporto errores' }

  Write-Output '== 3. migracion 039: tablas + flags base del torneo 07.5A sembrados'
  Invoke-AdminSql "USE [$oltp]; SELECT COUNT(*) AS certificacion_records FROM sys.tables WHERE name='ai_certification_records'; SELECT COUNT(*) AS requalification_flags_tabla FROM sys.tables WHERE name='ai_requalification_flags'; SELECT provider_id, model_id, capability_id FROM ai_requalification_flags ORDER BY provider_id, model_id;"

  Write-Output '== 4. IDEMPOTENCIA: segundo migrate = nada que aplicar (schema_migrations)'
  Push-Location $apiDir
  $out2 = & pnpm migrate 2>&1 | Out-String
  Pop-Location
  $out2 | Select-String -Pattern 'apply |ya aplicada|resultado|error' | ForEach-Object { $_.Line }
  if ($LASTEXITCODE -ne 0) { throw 'migrate idempotencia fallo' }
  if ($out2 -match 'apply \d{3}-') { throw 'migrate volvio a aplicar migraciones (idempotencia rota)' }
  if ($out2 -match 'fail |error ') { throw 'migrate idempotencia reporto errores' }

  Write-Output '== 5. BACKUP/RESTORE roundtrip: copia de seguridad restaurable'
  try {
    Invoke-AdminSql "BACKUP DATABASE [$oltp] TO DISK = N'$bak' WITH INIT, COMPRESSION;"
  } catch {
    throw "BACKUP fallo (revisa permisos del servicio SQL sobre $BackupDir; usa -BackupDir). $($_.Exception.Message)"
  }
  Invoke-AdminSql "RESTORE DATABASE [$restoreDb] FROM DISK = N'$bak' WITH RECOVERY, REPLACE, MOVE N'nc_b09_oltp' TO N'$BackupDir\nc_b09_5a_restore.mdf', MOVE N'nc_b09_oltp_log' TO N'$BackupDir\nc_b09_5a_restore_log.ldf';"
  Invoke-AdminSql "USE [$restoreDb]; SELECT COUNT(*) AS flag_count FROM ai_requalification_flags; SELECT COUNT(*) AS schema_ok FROM sys.tables WHERE name IN ('ai_certification_records','ai_requalification_flags');"

  Write-Output '== 6. DWH rebuild real: schema + ETL + fixtures (etl.realSql.test.ts)'
  $env:DWH_DATABASE = $dw
  $env:DWH_ENABLED = 'true'
  $env:DWH_SCHEDULED_LOAD_ENABLED = 'false'
  $env:DWH_STORE = 'sql'
  $env:AI_REAL_SQL_TEST = '1'
  Push-Location $apiDir
  $t = & pnpm vitest run src/modules/dwh/etl.realSql.test.ts 2>&1 | Out-String
  Pop-Location
  $t | Select-String -Pattern 'Test Files|Tests |FAIL|passed|failed' | ForEach-Object { $_.Line }
  if ($LASTEXITCODE -ne 0) { throw 'vitest dwh real sql fallo' }
  if ($t -match 'FAIL ') { throw 'tests dwh real sql con fallos' }

  Write-Output '== 7. persistencia de certificacion sobre SQL real (certification.realSql.test.ts)'
  $env:DB_NAME = $oltp
  Push-Location $apiDir
  $c = & pnpm vitest run src/modules/ai/certification/certification.realSql.test.ts 2>&1 | Out-String
  Pop-Location
  $c | Select-String -Pattern 'Test Files|Tests |FAIL|passed|failed' | ForEach-Object { $_.Line }
  if ($LASTEXITCODE -ne 0) { throw 'vitest certification real sql fallo' }
  if ($c -match 'FAIL ') { throw 'tests certification real sql con fallos' }

  Write-Output '-- verificacion desplegable real Build 09.5A COMPLETA (fresh 001-039, idempotencia, backup/restore, DWH, persistencia)'
}
finally {
  Write-Output '== 8. limpieza'
  try { Invoke-AdminSql "ALTER DATABASE $oltp SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $oltp;" } catch { Write-Output 'cleanup oltp ignorado' }
  try { Invoke-AdminSql "ALTER DATABASE $restoreDb SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $restoreDb;" } catch { Write-Output 'cleanup restore ignorado' }
  try { Invoke-AdminSql "ALTER DATABASE $dw SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $dw;" } catch { Write-Output 'cleanup dw ignorado' }
  try { Invoke-AdminSql "DROP LOGIN $login;" } catch { Write-Output 'cleanup login ignorado' }
  Remove-Item -LiteralPath $pwFile -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $BackupDir) { Remove-Item -LiteralPath $BackupDir -Recurse -Force -ErrorAction SilentlyContinue }
  Remove-Item Env:DB_USER, Env:DB_PASSWORD, Env:DB_SERVER, Env:DB_TRUST_CERT, Env:DB_NAME, Env:DWH_DATABASE, Env:DWH_ENABLED, Env:DWH_SCHEDULED_LOAD_ENABLED, Env:DWH_STORE, Env:AI_REAL_SQL_TEST -ErrorAction SilentlyContinue
}