# Staging Bring-Up Runbook (09.5A-S1)

Fecha: 2026-08-20. Rama: `hardening/remediation-09-5a` (sin push).
Release source: **56bbe4e** (o commit posterior únicamente por fixes del
staging). Proveedor-agnóstico: sin asunciones de cloud/VPS. A ejecutar SOLO
por el operador cuando exista infraestructura autorizada.

## 0. Preflight

```powershell
git status            # esperado: CLEAN
git branch --show-current   # hardening/remediation-09-5a (o -staging para fixes)
git log --oneline --decorate -10
```

Si el bring-up descubre bugs: commit nuevo en
`hardening/remediation-09-5a-staging`. Nunca despliegue con trabajo sin
commitear. Sin push salvo autorización explícita del operador.

PRODUCCIÓN NO SE TOCA. Antes de migración/seed/reset/backup/restore/DWH:
imprimir metadatos de target (sin secretos), exigir
`ENVIRONMENT_CLASS=STAGING` y `production=false`. Cualquier detección de
producción ⇒ `PRODUCTION_TARGET_BLOCKED` y STOP.

## 1. Identidad staging (contrato Build 09.5A)

Server-side (`.env` del host, nunca en git):

```
ENVIRONMENT_CLASS=STAGING
INSTANCE_ID=<id seguro, p.ej. staging-nc-01>
RELEASE_VERSION=<release>
DB_SERVER=<host SQL no local>
DB_NAME=<staging_nc_oltp>          # exigido explícito en STAGING
DWH_DATABASE=<staging_nc_dw>       # ≠ DB_NAME y ≠ defaults locales
CORS_ORIGIN=https://<frontend-origin>   # sin comodines
AI_CERTIFICATION_STORE=sql
```

La API arranca fail-fast: config malformada (clase UNKNOWN, DB_NAME=DWH,
CORS con `*`, contraseña vacía en PRODUCTION) ⇒ el servidor NO arranca
(`assertStartupConfigValid`). No debilitar la validación para "salir
rápido" (§18).

## 2. Provisionamiento OLTP + DWH

- Instancia SQL Server dedicada no producción.
- BD `staging_nc_oltp` (OLTP) y BD `staging_nc_dw` (DWH): **nunca la misma BD**.
- Logins SQL dedicados con contraseñas fuertes generadas (p.ej.
  `[System.Security.Cryptography.RandomNumberGenerator]` 32+ chars);
  **nunca** reutilizar la credencial histórica filtrada en git.
- Datos: SOLO fixtures sintéticos/curated/de-identificados (§11): 2
  sucursales, profesionales, pacientes, consultas, antropometría, labs,
  planes de comida, adherencia + fixtures RAG y memoria. NUNCA copiar
  producción ni PHI real.

## 3. Migraciones OLTP (001 → 039)

```powershell
pnpm install --frozen-lockfile
pnpm --filter @nutriclinica/api migrate
```

Verificar:

- todas las migraciones esperadas aplicadas (039/039);
- checksums válidos (runner existente);
- segunda ejecución = 0 pendientes (idempotencia);
- checks físicos de schema PASS;
- 039 es aditiva (CREATE TABLE + INSERT idempotente; sin DROP/ALTER
  destructivos) — la documentación de rollback reconoce que el rollback de
  la app ≠ downgrade destructivo de BD (§44).

## 4. DWH

- Inicializar con el mecanismo de schema/versioning independiente del
  Build 08 (schema `dwh-08-002`): `DWH_ENABLED=true`,
  `DWH_DATABASE=staging_nc_dw`, `DWH_SCHEDULED_LOAD_ENABLED=false`
  (disparar cargas manualmente en el smoke).
- Verificar: DWH ≠ OLTP, schema version correcta, catálogo semántico
  disponible, ETL ejecutable contra OLTP staging.

## 5. Build release (desde fuente limpia)

```powershell
pnpm lint
pnpm typecheck
pnpm test                    # frontend
pnpm build
pnpm --filter @nutriclinica/api typecheck
pnpm --filter @nutriclinica/api test
pnpm --filter @nutriclinica/api build
```

Baseline mínimo esperado: API 1130 passed / 54 skipped / 0 failed;
frontend 1994 passed / 1 skipped; lint 0 errores; typecheck PASS; build
PASS. Secret scan tracked: 0.

## 6. Manifiesto de despliegue

Generar/verificar vía `GET /deployment/manifest` (o contrato del módulo
`deployment`): release version, commit git, environment=STAGING, schema
OLTP (039), schema DWH (dwh-08-002), catálogo semántico, versiones de
políticas (knowledge/retrieval/AI/toolset), bundle de prompts, versión
frontend, deployedAt. Sin secretos.

## 7. Pre-deploy gate

`GET /deployment/predeploy` debe reportar (honestamente): release clean,
tests aceptables, secret scan 0, identidad STAGING, production=false, OLTP
safe, DWH safe, OLTP ≠ DWH, preview de migraciones, readiness de
backup/recovery, artefacto de rollback, estado de kill switches, flags
conocidos. Cualquier fallo crítico ⇒ STOP.

## 8. Deploy API

Topología soportada más simple: build `tsc` + `node dist/server.js` detrás
de un reverse proxy (nginx/caddy/IIS/equivalente), o el contenedor que el
operador elija (no introducir k8s/compose solo por moda, §58). Verificar:

- startup config validation PASS (fail-fast activo);
- `GET /deployment/identity` y `/deployment/readiness` coherentes;
- observabilidad: `GET /observability/health` con infra HEALTHY separada
  de MODEL ELIGIBILITY = BLOCKED_NO_ELIGIBLE_MODEL (§52).

## 9. Deploy frontend

- `VITE_API_BASE_URL=https://<api-staging-origin>` en el build.
- Servir `dist/` estático (Dockerfile/nginx existentes o equivalente).
- Verificar que NO quedan URLs `http://localhost` embebidas en el
  artefacto (grep del bundle: `localhost`, `127.0.0.1`).
- Sin secretos de backend en el artefacto.

## 10. HTTPS + CORS

- TLS en el reverse proxy (ACME o cert del proveedor); nunca HTTP plano
  hacia red externa. Si no puede: `TLS_READINESS = BLOCKED` (§20).
- CORS explícito: `CORS_ORIGIN=https://<frontend-origin>`; prohibido
  `Access-Control-Allow-Origin: *` con credenciales. Probar origen
  permitido (200) y no permitido (rechazado).

## 11. Smokes (contra staging real, sin mocks para aceptación)

- **Auth**: login/JWT/logout/revocación/denegación de usuario inactivo/
  role scoping con usuarios sintéticos.
- **WebSocket**: auth, tenant scope correcto, suscripción autorizada,
  cross-tenant denegado, reconexión. Sin fuga cross-tenant.
- **OLTP**: leer paciente/consulta/antropometría/labs/plan-adherencia
  sintéticos con scopes de tenant y paciente.
- **DWH/ETL**: load run, watermark, reconciliación, freshness, métrica
  semántica (volumen de consultas, crecimiento de pacientes, población de
  adherencia). **Reconciliación: pérdida inesperada = 0** (§26); si no ⇒
  STAGING DWH GATE = FAIL.
- **RAG**: protocolo aprobado vigente, no-answer, exclusión revocado/
  expirado, cita válida.
- **Memoria**: mismo paciente permitido, cross-patient denegado,
  cross-tenant denegado, expiración, preferencias, scope de conversación.
- **Observabilidad**: eventos de ejecución, health de provider/modelo,
  telemetría de tools/RAG/memoria/DWH, breaker, shadow readiness. Sin PHI.
- **AI**: `NUTRICLINICA_LOCAL_AUTO` → evaluación → NO_ELIGIBLE_MODEL →
  ABSTAIN (PASS, no fallo de despliegue). Llamada a capacidad protegida ⇒
  `NO_ELIGIBLE_MODEL` seguro. Provider adapter calls = 0 donde aplique
  (instrumentación/fake determinista permitido SOLO para esto).
- **AI kill switch**: activar estado de kill ⇒ 503 `AI_DISABLED` con 0
  llamadas al provider; restaurar estado.
- **Patient AI**: DISABLED; verificar que config ausente no lo habilita.
- **Shadow**: readiness real ⇒ `PROFESSIONAL SHADOW = BLOCKED_BY_MODEL`.
  No forzar activo. Kill/shadow simulado por camino técnico de test.
- **PHI/secret leak**: marcadores sintéticos en logs/telemetría/errores/
  artefactos ⇒ 0.

## 12. Backup / Restore / Rebuild

- `BACKUP DATABASE [staging_nc_oltp]` y `[staging_nc_dw]` a ubicación
  protegida fuera del host; sin secretos en ruta/nombre/log.
- Restore a BD distinta (`staging_nc_oltp_restore`) y verificar datos.
- DWH: rebuild desde OLTP staging + schema DWH.
- RAG/memoria: documentar recuperación/expiración real.
- Alternativa verificable local (ya entregada Build 09.5A):
  `scripts/verify-deployment-b09-5a.ps1` (fresh 001-039, idempotencia,
  backup/restore roundtrip, DWH, persistencia) — autoritativo SOLO local.

## 13. Rollback

- Release A → release B/current → smoke → rollback app a A → smoke.
- Sin downgrade destructivo de migraciones.
- Si no hay artefacto previo desplegable: `ROLLBACK_E2E =
  BLOCKED_BY_NO_PRIOR_ARTIFACT` (no fingir).

## 14. ETL scheduler + jobs + efectos externos

- Scheduler de ETL: lock/lease de una sola instancia; sin cargas duplicadas
  concurrentes.
- Inventariar jobs; deshabilitar integraciones que puedan contactar
  usuarios reales (email/SMS/notificaciones) salvo mock/sandbox explícito.
- Pagos/billing: sandbox o deshabilitado. Webhooks externos: deshabilitados
  salvo sandbox.
- AI cloud: `CLOUD_PROVIDER = NOT_CONFIGURED` es aceptable; sin cookies web.

## 15. Limpieza

Eliminar scripts temporales, credenciales temporales, dumps, .env de test,
marcadores generados. Verificar `git status` CLEAN y secret scan 0.

## 16. Criterios de salida (resumen)

Despliegue genuinamente no-local, distinto de producción, commit trazable,
identidad STAGING explícita, guards PASS, OLTP/DWH reales y separados,
migraciones 039/039 idempotentes, fixtures sintéticos, frontend+API
desplegados y alcanzables, HTTPS (si externo), smokes PASS, reconciliación
0, PHI 0, secretos 0, kill switch PASS, Patient AI DISABLED, LOCAL_AUTO
ABSTAIN, modelos fallidos NO invocados, shadow BLOCKED_BY_MODEL honesto,
backup/recovery verificado, rollback verificado o bloqueo honesto, efectos
externos sandbox/disabled, regresiones PASS, worktree CLEAN.