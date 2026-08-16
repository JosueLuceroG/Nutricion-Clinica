# SQL Server Verification Runbook (REMEDIATION BUILD 02)

Guía práctica para verificar migraciones e integración del API contra un SQL
Server real. Todas las lecciones aquí fueron validadas empíricamente en SQL
Server 2022 Express (instancia local `localhost\SQLEXPRESS`) durante el
REMEDIATION BUILD 02.

Regla general: **los mocks y archivos NO cuentan**. Todo flujo SQL debe
verificarse contra una base real; localhost no es staging, y la DB de desarrollo
(`nutriclinica`) NO se toca: se trabaja en bases desechables `nc_b0X_*`.

## 1. Identificar el entorno sin imprimir secretos

```powershell
# Instancia + versión (Windows auth, sin contraseñas en el comando)
& "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE" -S "localhost\SQLEXPRESS" -E -C -Q "SELECT @@VERSION"
```

- `-E` = Windows auth; `-C` = trust server certificate.
- **`-I` es obligatorio** para ejecutar archivos de migración con `sqlcmd`:
  sin `-I`, `QUOTED_IDENTIFIER` queda OFF y las migraciones que crean índices
  sobre columnas computadas fallan (`Msg 1934`).
- Estado de la DB dev: `SELECT filename, applied_at, checksum FROM schema_migrations ORDER BY filename`.

## 2. Base desechable + login SQL dedicado

El driver `mssql` (Node) no autentica cuentas locales de Windows vía NTLM
(`Login failed ... untrusted domain`). Solución: login SQL dedicado.

1. Generar contraseña fuerte SIN imprimirla (guardar en archivo temp, borrar al final):
   ```powershell
   $pw = -join ((48..57)+(65..90)+(97..122)+@(33,35,36,37,38,42,45,95) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
   Set-Content -Path "$env:TEMP\sql-pw.txt" -Value $pw -NoNewline
   ```
2. Crear login + usuario (sqlcmd -E, script con la variable interpolada, no embebida en el transcript):
   ```sql
   IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'nc_b02_ci')
     CREATE LOGIN nc_b02_ci WITH PASSWORD = N'...', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
   IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'nc_b02_ci')
     CREATE USER nc_b02_ci FOR LOGIN nc_b02_ci;
   ALTER ROLE db_owner ADD MEMBER nc_b02_ci;
   ```
3. Override del `.env` para apuntar a la base desechable (dotenv NO pisa env ya definidas):
   ```powershell
   $env:DB_USER='nc_b02_ci'; $env:DB_PASSWORD=$pw; $env:DB_NAME='nc_b02_fresh'; $env:DB_SERVER='localhost\SQLEXPRESS'; $env:DB_TRUST_CERT='true'
   ```

## 3. Fresh install verificado (34/34)

```powershell
$env:DB_NAME='nc_b02_fresh'; pnpm migrate   # en apps/api
```
- Esperado: 34 archivos, 0 errores; segundo run: 34 skip (idempotencia).
- Verificar checksums archivo ↔ DB (SHA-256 UTF-8 con CRLF normalizado a LF):
  `SELECT filename, checksum FROM schema_migrations` y comparar con el hash
  local; mismatch = error (sin `--force`).
- Verificación física de objetos: `sys.tables`, `sys.columns`, `sys.check_constraints`,
  `sys.default_constraints` por cada migración 023–034 (tables AI/security).

## 4. Upgrade path verificado (001–019 + datos → 020–034)

1. Aplicar 001–019 con `sqlcmd -E -C -I -b -d nc_b02_upgrade -i <archivo>` (uno por uno).
2. Registrar 001–019 en `schema_migrations` con los checksums de los archivos
   (misma tabla DDL que crea `migrate.ts`; `applied_at` default SYSUTCDATETIME).
3. Insertar datos sintéticos en las 8 entidades (sucursales, profesionales,
   pacientes, consultas, antropometrias, planes_alimenticios, lab_panels,
   adherence_records) — **los `id` son `uniqueidentifier` SIN default**: insertar `NEWID()` explícito.
4. `pnpm migrate` → 15 aplicadas (020–034), 19 skip.
5. Reconciliar conteos antes/después (pérdida 0) + spot checks de los efectos
   de 026 (token_version backfill) y 027 (columnas json NULL sin tocar datos).

## 5. Gotchas reales de SQL Server (bugs que solo aparecen en el gate real)

| Patrón | Falla real | Fix |
|---|---|---|
| `EXEC(N'...' + QUOTENAME(@x))` | `Incorrect syntax near 'QUOTENAME'` (solo concatena variables) | `DECLARE @sql NVARCHAR(MAX) = N'...' + QUOTENAME(@x); EXEC(@sql);` |
| `ALTER ADD col` + `UPDATE col` en el mismo batch | `Invalid column name` (compilación por batch) | `GO` entre ALTER y UPDATE |
| `BEGIN TRANSACTION` / `COMMIT` en batches distintos (driver mssql = sp_executesql) | `Transaction count after EXECUTE ...` | BEGIN+COMMIT en el mismo batch, o sin transacción (ALTER idempotente) |
| `sqlcmd` sin `-I` | `Msg 1934` índices sobre columnas computadas | `-I` siempre |
| Columna `plan` sin corchetes en SELECT/INSERT | `Incorrect syntax near the keyword 'plan'` (keyword reservado) | `[plan]` |
| `.input("last_id", sql.UniqueIdentifier(), "")` (primer pull sin cursor) | `Validation failed for parameter 'last_id'. Invalid GUID.` | `lastId \|\| "00000000-0000-0000-0000-000000000000"` |
| `INSERT ... (id)` sin valor | `Cannot insert the value NULL into column 'id'` | `NEWID()` explícito |
| NTLM cuenta local vía tedious | `Login failed ... untrusted domain` | Login SQL dedicado |

## 6. Smoke de integración real (HTTP → API → SQL)

1. Seed con `SEED_ADMIN_PASSWORD` ≥ 12 chars (fail-closed) contra la base desechable.
2. API: `PORT=3000 pnpm dev` con los overrides de env; `CORS_ORIGIN=http://localhost:1420`.
3. Secuencia: health → login → `/auth/me` → logout → token viejo 401 → 2FA
   setup/enable (TOTP real, HMAC-SHA1/base32) → token pre-2FA revocado 401 →
   login requires2fa → completar 2FA → disable → login simple → usuario inactivo
   DENIED (403) → sync manifest/pull → aislamiento tenant (push body sucursal
   ajena 400; pull sucursal ajena 403; paciente de otra sucursal 404) →
   alta/lectura expediente → sin token 401.
4. **`x-sucursal-id` header es obligatorio** en rutas con `requireSucursalAccess`
   (o query param `sucursalId`); el admin lo omite, el resto no.
5. `authRateLimit` es por ventana en memoria: al reiniciar la API se limpia.
6. Verificar en DB: `audit_log` (login/logout/update/sync) y `token_version` (bumps tras 2FA/logout).

## 7. E2E (Playwright)

- Stack: API en `:3000` (default del frontend, configurable vía `VITE_API_URL`),
  web en `:1420` (`pnpm dev` o `vite preview` tras `pnpm build`).
- Credenciales: `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` (default `admin123!`).
- Las assertions del dashboard (`Pacientes nuevos`, `Actividad clínica`) requieren
  una DB con datos ricos: contra una base mínima fallan aunque el login funcione.
- Bug de entorno conocido (ver Build 02): el botón `.nc-submit` computa `height: 0px`
  en Chromium headless (dev y preview) pese a que la regla CSS aplica
  (`height: 68px`, única regla, sin override); el submit vía Enter funciona.
  Investigar antes de declarar E2E completo: sospechoso de quirk de rendering
  headless en esta máquina, no de lógica de la app.

## 8. Reglas de cierre

- No tocar `nutriclinica` (dev) ni producción; DBs desechables para todo.
- No imprimir ni commitear credenciales (login SQL dedicado, seed admin, JWT).
- Borrar archivos temp con contraseñas al terminar; eliminar logins/dbs desechables si aplica.
- Mocks ≠ verificación: el gate real se cierra solo con SQL Server real + smoke HTTP.