$ErrorActionPreference = 'Stop'
$sqlcmd = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
$server = 'localhost\SQLEXPRESS'
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 8)
$database = "nc_step03a_sync_$suffix"
$login = "nc_step03a_runner_$suffix"
$apiDir = Join-Path $PSScriptRoot '..\apps\api'
if (!(Test-Path -LiteralPath $apiDir) -or !(Test-Path -LiteralPath $sqlcmd)) {
  throw 'BLOCKED_BY_ENVIRONMENT: API directory or local SQL tooling unavailable'
}
$names = @('DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_PORT', 'DB_NAME', 'DB_TRUSTED', 'DB_TRUST_CERT', 'DB_ENCRYPT', 'ENVIRONMENT_CLASS', 'SYNC_REAL_SQL_TEST')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name) }
$createdDb = $false
$createdLogin = $false
function Invoke-LocalSql([string]$query) {
  & $sqlcmd -S $server -E -C -b -I -W -Q $query
  if ($LASTEXITCODE -ne 0) { throw 'Local controlled SQL command failed (query omitted)' }
}
try {
  # A fresh random name is never reused or reset. No production configuration is loaded.
  Invoke-LocalSql "IF DB_ID('$database') IS NOT NULL THROW 51000, 'Disposable database collision', 1; CREATE DATABASE [$database];"
  $createdDb = $true
  $password = [guid]::NewGuid().ToString('N') + 'Aa9!'
  Invoke-LocalSql "CREATE LOGIN [$login] WITH PASSWORD='$password', CHECK_POLICY=ON;"
  $createdLogin = $true
  Invoke-LocalSql "ALTER AUTHORIZATION ON DATABASE::[$database] TO [$login];"
  $env:DB_USER = $login
  $env:DB_PASSWORD = $password
  $env:DB_SERVER = $server
  $env:DB_PORT = $null
  $env:DB_NAME = $database
  $env:DB_TRUSTED = 'false'
  $env:DB_TRUST_CERT = 'true'
  $env:DB_ENCRYPT = 'false'
  $env:ENVIRONMENT_CLASS = 'TEST'
  $env:SYNC_REAL_SQL_TEST = '1'
  & pnpm --dir $apiDir migrate
  if ($LASTEXITCODE -ne 0) { throw 'Fresh migration failed' }
  & pnpm --dir $apiDir migrate
  if ($LASTEXITCODE -ne 0) { throw 'Idempotent migration failed' }
  & pnpm --dir $apiDir exec vitest run src/modules/sync/syncIntegrity.realSql.test.ts
  if ($LASTEXITCODE -ne 0) { throw 'Real SQL sync integrity tests failed' }
}
finally {
  try {
    if ($createdDb) { Invoke-LocalSql "ALTER DATABASE [$database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$database];" }
    if ($createdLogin) { Invoke-LocalSql "DROP LOGIN [$login];" }
  }
  finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name]) }
    $password = $null
  }
}
