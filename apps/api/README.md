# NutriClinica API

Backend HTTP para NutriClinica: autenticacion JWT, multi-tenancy, sync queue, RBAC, facturacion.

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
cd apps/api
pnpm migrate         # corre las 4 migraciones SQL en orden
pnpm seed            # crea 1 sucursal + 1 admin (idempotente)
pnpm dev             # arranca API en http://localhost:3000
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

```bash
pnpm migrate          # aplica lo nuevo
pnpm migrate --force  # re-aplica todo
```

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

## Proximos pasos (Sprint 14A)

- 14A.4: rutas /auth/login, /auth/register, /auth/me + middleware `requireAuth`
- 14A.5: middleware `requireSucursalAccess` (filtra queries por sucursal_id del JWT)
- 14A.6: endpoints REST para pacientes, consultas, mediciones, lab, planes
- 14A.7: endpoints /sync/pull, /sync/push, /sync/manifest
