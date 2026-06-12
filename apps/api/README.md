# NutriClinica API

Backend HTTP para NutriClinica: autenticacion JWT, multi-tenancy, sync queue, RBAC, facturacion, telemedicina e IA server-side.

## Stack
- Node.js 20+
- TypeScript (strict, ESNext modules)
- Express 4
- mssql 11 (SQL Server)
- argon2 (password hashing)
- jsonwebtoken
- zod (validacion)
- Vitest

## Setup local

### 1. Crear base de datos y usuario en SQL Server

Conectate a SQL Server Management Studio o `sqlcmd` como `sa` y ejecuta:

```sql
CREATE DATABASE nutriclinica;
GO

CREATE LOGIN nutriclinica_app WITH PASSWORD = 'CambiaEstaPassword123!';
USE nutriclinica;
CREATE USER nutriclinica_app FOR LOGIN nutriclinica_app;
ALTER ROLE db_owner ADD MEMBER nutriclinica_app;
GO
```

> El rol `db_owner` es solo para dev. En produccion crea un rol con permisos
> mas granulares (SELECT, INSERT, UPDATE, DELETE por esquema).

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# editar .env con tus valores reales
```

### 3. Generar JWT secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copia el hex a `JWT_SECRET` en `.env`.

### 4. Instalar dependencias y correr migraciones

Desde la raiz del monorepo:

```bash
pnpm install
pnpm --filter @nutriclinica/api migrate  # corre las migraciones SQL en orden
pnpm --filter @nutriclinica/api seed     # crea 1 sucursal + 1 admin (idempotente)
pnpm --filter @nutriclinica/api dev      # arranca API en http://localhost:3000
```

### 5. Verificar

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"nutriclinica-api","version":"0.1.0"}
```

## Migraciones

Los archivos en `migrations/*.sql` se ejecutan en orden alfabetico. Cada uno es
idempotente (usa `IF NOT EXISTS`). El runner:

- Calcula SHA-256 de cada archivo y lo guarda en `schema_migrations`.
- Si el archivo ya se aplico con el mismo checksum, lo salta.
- Si el checksum cambio y no pasas `--force`, reporta error.
- Si pasas `--force`, re-ejecuta (util cuando editas una migracion en dev).
- Separa batches SQL Server solo por lineas `GO`; no parte bloques `IF/BEGIN/END` por `;`.

```bash
pnpm --filter @nutriclinica/api migrate          # aplica lo nuevo
pnpm --filter @nutriclinica/api migrate --force  # re-aplica todo
```

## Seguridad operativa

- `CORS_ORIGIN` debe listar los origenes permitidos. En dev Vite/Tauri usa `http://localhost:1420`, `http://127.0.0.1:1420` y `tauri://localhost`.
- `POST /auth/login` tiene rate limit en memoria. En produccion multi-instancia, reemplazarlo por store compartido (Redis/SQL).
- `POST /auth/register` requiere autenticacion y rol `admin`; no exponerlo como registro publico.
- Los secretos TOTP se guardan cifrados. Configura `TOTP_ENCRYPTION_KEY` o `FIELD_ENCRYPTION_KEY`; si faltan, se usa `JWT_SECRET` como fallback para dev.
- La migracion `019-totp-secret-length.sql` amplia `profesionales.totp_secret` para secretos cifrados.
- Las llaves de IA son server-side only: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`. Nunca uses prefijo `VITE_` para secretos.
- `POST /ai/complete` requiere JWT, sucursal activa, validacion Zod y rate limit; audita metadatos, no payload clinico completo.
- WebSocket de telemedicina valida token, existencia de sala, sucursal/admin y que la sala siga activa antes de relayar mensajes.
- Sync soporta solo `pacientes`, `consultas`, `antropometrias`, `lab_panels`, `planes_alimenticios` y `adherence_records` hasta que existan mapeos SQL completos para mas entidades.

## Estructura

```
apps/api/
  migrations/         # .sql en orden alfabetico
  src/
    server.ts         # bootstrap Express
    db/
      connection.ts   # pool mssql singleton
      migrate.ts      # runner de migraciones
      seed.ts         # crea sucursal + admin inicial
    middleware/
      errorHandler.ts # HttpError + handler 500
    routes/
      health.ts       # GET /health, GET /health/db
  tests/              # vitest
  .env.example
```

## Verificacion

```bash
pnpm --filter @nutriclinica/api typecheck
pnpm --filter @nutriclinica/api test
```
