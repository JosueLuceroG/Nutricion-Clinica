# NUTRICLÍNICA — REAL STAGING BRING-UP & VERIFICATION REPORT

Operational Gate 09.5A-S1. Fecha: 2026-08-20. Rama:
`hardening/remediation-09-5a` (sin push). Modo: BUILD / OPERATIONS.

## Git State Before

- Branch: `hardening/remediation-09-5a` (esperado).
- HEAD: `56bbe4e` (REMEDIATION BUILD 09.5A).
- Worktree: CLEAN.
- `git status` vacío; sin cambios sin commitear al inicio.

## Release Source

- `56bbe4e` (Build 09.5A). Sin commits nuevos de código: esta verificación
  no requirió fixes de staging (no existía staging).
- Documentación entregada en este gate: `staging-infrastructure-
  requirements.md`, `staging-bring-up-runbook.md`, este reporte.

## Infrastructure Discovery

Inventario del repositorio en `56bbe4e`:

- **GitHub Actions**: `ci.yml` (solo calidad: lint/typecheck/test/build en
  `main|develop|feature/**|release/**`; NO corre sobre `hardening/**`; sin
  servicio SQL Server; sin job de despliegue) y `release.yml` (tags `v*` →
  artefactos Tauri desktop → GitHub Releases). **No existe workflow de
  despliegue a servidor.**
- **Dockerfile** (raíz): build estático de frontend (nginx → `dist/`);
  frontend-only, no empaqueta la API; no referenciado por ningún
  workflow/script.
- **nginx.conf**: `listen 80` únicamente; sin TLS.
- **scripts/**: solo verificación (verify-deployment-b09-5a.ps1, verify-
  dwh-b08.ps1, verify-sql-037.ps1, verify-telemetry-b09.ps1). Sin
  provisionamiento ni despliegue.
- **Sin IaC**: no terraform, no docker-compose, no k8s, no config de
  servidor, no DNS, no certificados, no secret store, sin políticas de red.
- **Targets actuales**: todos de la máquina de desarrollo — SQL Server
  `localhost\SQLEXPRESS` (BDs desechables nc_b09_* ), API
  `http://localhost:3000`, CORS `localhost:1420`/`tauri://localhost`,
  Ollama local (`CPU_ONLY_LOW`).
- **Remote**: `origin https://github.com/JosueLuceroG/Nutricion-Clinica`
  (sin push en este gate; sin autorización).

## Staging Classification

**C. NO_REAL_STAGING_INFRASTRUCTURE.**

No existe en el repositorio ni en el entorno de ejecución ningún target de
despliegue no producción: sin host, sin BD no local, sin DNS/TLS, sin
credenciales de despliegue, sin proveedor seleccionado ni autorizado.

## Why This Is / Is Not Real Staging

- NO hay staging porque no hay infraestructura de despliegue: nada que
  cumpliera §2 (identidad no producción, OLTP/DWH no producción, secretos
  no producción, API/frontend desplegables, endpoint de red real,
  environmentClass=STAGING, HTTPS, observabilidad, kill switches, rollback,
  backup).
- La máquina de desarrollo (localhost, SQL Express desechable, API en
  `:3000`) es LOCAL/TEST según el contrato del Build 09.5A y §1. No se le
  llama staging. No se crea evidencia falsa.
- El contrato de despliegue seguro del Build 09.5A (`apps/api/.env.example`,
  guards fail-closed) está verificado localmente por tests, pero jamás se
  ejecutó contra infraestructura real.

## Deployment Topology

N/A — sin topología de despliegue real. Topología propuesta para el
operador (runbook, proveedor-agnóstico): host API (Node 24) detrás de
reverse proxy con TLS + host estático de frontend + 2 BDs SQL separadas +
storage de backups + DNS.

## Environment Identity

No configurada en ningún entorno real. Contrato documentado en
`apps/api/.env.example` (Build 09.5A): `ENVIRONMENT_CLASS=STAGING`,
`INSTANCE_ID`, `RELEASE_VERSION`, orígenes públicos API/frontend, commit de
despliegue. Validación fail-fast verificada por tests
(`startupValidation.test.ts`, 10 tests; `environmentIdentity.test.ts`).

## Production Protection

PASS (verificación local fail-closed, §55). Guards probados (75/75 en
suites targeted):

- `environmentIdentity`: clase UNKNOWN con `NODE_ENV=production` ⇒ arranque
  bloqueado; STAGING/PRODUCTION exigen DB_NAME/DWH_DATABASE explícitos,
  distintos y no-default; CORS sin comodines; PRODUCTION sin contraseña
  vacía.
- `targetGuard`/`stagingReset`: reset/seed/migración contra PRODUCTION,
  clase UNKNOWN o OLTP=DWH ⇒ FAIL CLOSED (E2E rollback: LOCAL/PRODUCTION/
  NODE_ENV=production).
- `deployment.e2e.test.ts`: kill switch 503 `AI_DISABLED` con 0 llamadas al
  provider; staging reset fail-closed; smoke LOCAL coherente.

PRODUCTION TOUCHED: NO (nada se ejecutó contra ningún target).

## Configuration

Solo configuración local verificada en este gate (ninguna staging):
`ENVIRONMENT_CLASS=LOCAL` en `.env.example`; guards de arranque activos en
el suite. Sin configuración staging real (inexistente).

## Secret Handling

- `.env` NO se trackea (verificado en 09.5A); `.env.example` es contrato.
- Sin secretos commitheados; scan: 0.
- Sin credenciales de staging (no existe staging); no se inventan
  credenciales (§3).
- Histórico: credencial SQL expuesta en git anteriormente —
  `HISTORICAL SQL CREDENTIAL ROTATION = STILL_REQUIRED` (el uso de
  contraseñas nuevas en un futuro staging NO completa este requisito;
  solo `VERIFIED_BY_OPERATOR` del operador lo hace, §14).

## OLTP Staging

BLOCKED — no existe BD OLTP no producción.

## OLTP Migration Verification

- En staging: BLOCKED (nada que migrar).
- Local (autoritativo para el código, §60): Build 09.5A verificó 039/039 en
  `nc_b09_oltp` desechable con `scripts/verify-deployment-b09-5a.ps1`
  (fresh 001-039, idempotencia: segunda ejecución = 0 pendientes, checksums,
  checks físicos). Migraciones 001-038 inmutables; 039 aditiva.

## DWH Staging

BLOCKED — no existe BD DWH no producción.

## DWH Schema Verification

- En staging: BLOCKED.
- Local: schema DWH `dwh-08-002` (Build 08), 17/17 suites real SQL en
  nc_b08/nc_b09; ETL con watermark y reconciliación.

## Synthetic Data

No se crearon fixtures staging (no existe staging). Contrato de datos para
el futuro staging (runbook): solo sintéticos/curated/de-identificados — 2
sucursales, profesionales, pacientes, consultas, antropometría, labs,
planes de comida, adherencia + fixtures RAG y memoria. Prohibido copiar
producción/PHI.

## API Deployment

BLOCKED — no existe host. `pnpm --filter @nutriclinica/api build` PASS
local (artefacto reproducible).

## Frontend Deployment

BLOCKED — no existe host. `pnpm build` PASS local (`dist/`, ✓ built in
31.32s). Dockerfile+nginx.conf disponibles (sin TLS, frontend-only) pero
nunca desplegados.

## TLS / HTTPS

NOT_APPLICABLE — sin endpoint externo. Requisito documentado (runbook §10):
HTTPS obligatorio si es alcanzable por red externa; si no se puede:
`TLS_READINESS = BLOCKED`.

## CORS

Verificado a nivel de contrato/guard localmente (sin comodines en
STAGING/PRODUCTION, orígenes explícitos; tests de deployment). Smoke contra
staging: BLOCKED.

## Auth Smoke

BLOCKED (no hay endpoint). Rutas y guards de auth existentes verificados en
la suite (roles, revocation, inactive denial cubiertos por tests locales).

## WebSocket Smoke

BLOCKED (no hay endpoint). Aislamiento de tenant cubierto por tests locales
(syncRoutesAuthorization, chatServer).

## OLTP Smoke

BLOCKED (no hay BD staging). Repositorios SQL reales verificados
localmente en builds previos (erpTools.realSql 18/18 en nc_b061 fixture).

## DWH / ETL Smoke

BLOCKED (no hay BD staging). ETL real 17/17 local (Build 08/09.5A).

## DWH Reconciliation

BLOCKED en staging; local Build 08: UNEXPECTED ROW LOSS = 0 (pérdida
inesperada 0, reconciliación MERGE verificada).

## RAG Smoke

BLOCKED (no hay staging). Local: retrieval-policy.v2 (recall 1.0, forbidden
0, no-answer explícito, citas verificadas) — suite unitaria PASS.

## Memory Smoke

BLOCKED (no hay staging). Local: aislamiento 0 fugas (cross-patient/cross-
tenant denegados), TTL, preferencias con whitelist — tests PASS.

## Observability Smoke

BLOCKED (no hay staging). Módulo `/observability` verificado localmente
(eventos tipados sin PHI, guard PHI, store memory/sql, health infra vs
modelo, retención).

## AI Runtime Smoke

BLOCKED en staging. Local: `NUTRICLINICA_LOCAL_AUTO` evaluado por tests
(localAutoSelector 18 tests, abstention contract, orquestador 403
`NO_ELIGIBLE_MODEL` fail-closed con 0 llamadas al provider).

## NUTRICLINICA_LOCAL_AUTO

ABSTAIN_NO_ELIGIBLE_MODEL (verificado por tests locales). Sin modelo
eligible, el runtime abstiene — comportamiento correcto y esperado, NO es
fallo de despliegue.

## Current Model Eligibility

NONE. Los candidatos del torneo 07.5A (llama3.2, medgemma:4b, gemma3:4b,
qwen2.5:7b, ministral-3:8b) siguen NO eligible; NO se aprueban manualmente;
NO se bajan umbrales; gpt-oss BLOCKED_BY_HARDWARE; cloud
BLOCKED_BY_CREDENTIAL/NOT_CONFIGURED.

## AI Kill Switch

PASS (mecanismo verificado localmente E2E: estado de kill activo ⇒ 503
`AI_DISABLED` y 0 llamadas al provider; restauración correcta). Smoke
contra staging: BLOCKED.

## Patient AI Status

DISABLED. Config ausente no puede habilitarlo (guards en suite; no se
ejercita Patient AI en producción).

## Shadow Readiness

PROFESSIONAL SHADOW = BLOCKED_BY_MODEL (esperado). Incluso si el staging
existiera y pasara, el shadow profesional no puede estar READY sin modelo
clínico eligible. No se fuerza activo.

## Backup

BLOCKED en staging (no hay BD). Mecanismo verificado localmente en Build
09.5A: `scripts/verify-deployment-b09-5a.ps1` (BACKUP/RESTORE roundtrip a
`nc_b09_5a_restore`, MOVE logical names) + runbooks R02/R03 del reporte
09.5A.

## Restore / Rebuild

BLOCKED en staging. Local: restore roundtrip verificado (ver arriba);
DWH rebuild desde OLTP staging + schema documentado; RAG/memoria con
procedimientos de recuperación/expiración documentados.

## Rollback

BLOCKED — sin artefacto previo desplegable en infraestructura real:
`ROLLBACK_E2E = BLOCKED_BY_NO_PRIOR_ARTIFACT` (no se finge). Mecanismo
documentado (runbook §13): app rollback ≠ downgrade destructivo de BD;
migración 039 aditiva permite rollback de app sin tocar datos.

## External Side-Effect Safety

SANDBOXED_OR_DISABLED (por contrato de configuración): sin integraciones
externas configuradas (email/SMS/pagos/webhooks no habilitados en el
contrato staging); runbook §14 exige deshabilitar/sandbox antes del
bring-up. AI cloud: `CLOUD_PROVIDER = NOT_CONFIGURED` (aceptable).

## Certification Persistence

YES (verificado localmente, §51): `certificationPersistence.test.ts` con
despliegue determinista falso — cualificación persistida sobrevive
reinicio (store sql), vacío/ausente = NOT_ELIGIBLE, carga fallida =
fail-fast de arranque.

## Fingerprint Invalidation

YES: cambio de fingerprint de despliegue ⇒ registro stale ⇒
REQUALIFICATION_REQUIRED; la cualificación antigua NUNCA se reutiliza en
caliente. Verificado por tests de persistencia + clinicalCertification.

## PHI Leak Test

0 (local). E2E de fuga: errorHandler con marcadores sintéticos en STAGING/
UNKNOWN ⇒ respuestas genéricas sin PHI/secretos (`deployment.e2e.test.ts`
leak tests); guard PHI en observabilidad; sanitzer por clase de entorno.
En staging real: BLOCKED (sin artefactos desplegados que escanear).

## Secret Leak Test

0. Scan tracked (`git grep` de patrones de secretos conocidos + clave
histórica): 0 hits. Scan de pre-deploy (preDeployGate secret_scan):
PASS. En staging real: BLOCKED.

## Deployment Health

BLOCKED — no hay entorno desplegado. Contrato del módulo `/deployment`
(listo para staging): health sections machine-readable APPLICATION/OLTP/
DWH/RAG/MEMORY/OBSERVABILITY/AI INFRASTRUCTURE/MODEL ELIGIBILITY/SHADOW
READINESS, distinguiendo infra HEALTHY de BLOCKED_NO_ELIGIBLE_MODEL.

## Staging Acceptance E2E

BLOCKED (no ejecutable sin infraestructura; §54: los mocks no sustituyen al
despliegue). Flujo objetivo documentado en el runbook: frontend → login →
API → OLTP → DWH → RAG → memoria → observabilidad → AI ABSTAIN →
shadow BLOCKED_BY_MODEL.

## CI/CD Status

- `ci.yml`: calidad únicamente; NO corre en `hardening/**`; sin SQL Server
  en CI (SQL real local sigue siendo autoritativo, §60); sin deploy.
- `release.yml`: artefactos Tauri por tags; sin despliegue de servidor.
- CI STAGING DEPLOY: **BLOCKED_BY_CREDENTIAL** (sin secretos ni target).
- Sin push sin autorización del operador.

## Regression

Ejecutada completa en este gate (fuente limpia, commit 56bbe4e):

- API (aislado, 2 corridas): **1130 passed / 54 skipped / 0 failed** (EXIT=0).
  Nota honesta: 1 corrida ejecutada en paralelo con la suite frontend bajo
  carga mostró 1 fallo no reproducible (flake por contención de recursos);
  2 corridas aisladas posteriores = baseline exacto.
- Frontend: **1994 passed / 1 skipped** (149 files, EXIT=0) — baseline exacto.
- Lint: 0 errores / 9 warnings pre-existentes (EXIT=0).
- Typecheck: PASS (EXIT=0).
- Build: PASS (✓ built in 31.32s, EXIT=0).
- Secret scan: 0.
- Guards targeted (deployment + certificationPersistence + shadow): 75/75.

## Debug Cleanup

Sin scripts temporales ni credenciales creadas en este gate. Sin dumps.
Sin .env generados. Marcadores sintéticos: solo dentro de tests (no
persistidos). Sin artefactos sensibles.

## Operator Actions Required

1. Seleccionar y autorizar proveedor/hardware de staging (cloud o on-prem)
   — requisito #1 del matrix.
2. Confirmar/ejecutar la rotación de la credencial SQL histórica
   (reportar `VERIFIED_BY_OPERATOR`).
3. Definir DNS + TLS (dominio staging, certificado).
4. Provisionar hosts (API, frontend) y 2 BDs SQL separadas (OLTP/DWH) +
   storage de backups + secret store/inyección.
5. Generar credenciales staging nuevas y fuertes; inyectarlas server-side
   (nunca en repo).
6. Ejecutar `docs/operations/staging-bring-up-runbook.md` y reportar
   resultados (smokes, backups, rollback).
7. Designar ownership de infraestructura y reviewers profesionales
   (futuro shadow 09.5B).

## Known Issues

- 1 flake ambiental de API suite observado solo bajo ejecución paralela
  (contención de recursos), no reproducible en corridas aisladas; baseline
  exacto en 2/2 corridas aisladas.
- Dockerfile actual es frontend-only y sin TLS (nginx.conf `listen 80`):
  suficiente para frontend estático tras reverse proxy, insuficiente como
  entrada directa.
- CI no cubre ramas `hardening/**` ni SQL Server real (§59/§60).

## External Blockers

- REAL STAGING: BLOCKED / NOT YET VERIFIED (no existe infraestructura).
- HISTORICAL SQL CREDENTIAL ROTATION: STILL_REQUIRED (pendiente operador).
- CURRENT ELIGIBLE CLINICAL MODEL: NONE.
- PROFESSIONAL CLINICAL VALIDATION: NOT_DONE.
- PRODUCTION CLINICAL CERTIFICATION: NOT_GRANTED.
- CLINICAL RELEASE GATE: NOT_READY.
- CI STAGING DEPLOY: BLOCKED_BY_CREDENTIAL.
- TLS/DNS/secret store: no configurados (sin infraestructura).

## Gate Status

Operational analysis exitoso y honesto; bring-up de staging NO ejecutado
por ausencia de infraestructura real. Fail closed.

OPERATIONAL GATE 09.5A-S1:
CONDITIONAL

REAL STAGING:
BLOCKED

STAGING CLASS:
C. NO_REAL_STAGING_INFRASTRUCTURE

STAGING URL/IDENTITY:
NOT_AVAILABLE

STAGING IS LOCALHOST:
NO

STAGING IS PRODUCTION:
NO

PRODUCTION TOUCHED:
NO

DEPLOYED COMMIT:
NOT_APPLICABLE (release source 56bbe4e; sin despliegue)

ENVIRONMENT GUARDS:
PASS

OLTP STAGING SQL:
BLOCKED

DWH STAGING SQL:
BLOCKED

OLTP/DWH SEPARATED:
YES

OLTP MIGRATIONS:
0/039 (staging inexistente; 039/039 verificado local)

OLTP MIGRATION IDEMPOTENCY:
PASS (verificado local 09.5A; staging BLOCKED)

DWH SCHEMA:
dwh-08-002 (verificado local; staging BLOCKED)

DWH RECONCILIATION UNEXPECTED LOSS:
0 (verificado local; staging BLOCKED)

FRONTEND STAGING:
BLOCKED

API STAGING:
BLOCKED

HTTPS:
NOT_APPLICABLE

AUTH SMOKE:
BLOCKED

WEBSOCKET SMOKE:
BLOCKED

RAG SMOKE:
BLOCKED

MEMORY ISOLATION:
BLOCKED

OBSERVABILITY:
BLOCKED

RAW PHI LEAK:
0 (local; staging BLOCKED)

SECRET LEAK:
0 (local; staging BLOCKED)

AI KILL SWITCH:
PASS (mecanismo local E2E; smoke staging BLOCKED)

PATIENT AI:
DISABLED

CURRENT ELIGIBLE CLINICAL MODEL:
NONE

FAILED MODEL USED:
NO

NUTRICLINICA_LOCAL_AUTO:
ABSTAIN_NO_ELIGIBLE_MODEL

PROFESSIONAL SHADOW:
BLOCKED_BY_MODEL

PROFESSIONAL CLINICAL SAMPLE:
0

PROFESSIONAL CLINICAL VALIDATION:
NOT_DONE

BACKUP:
BLOCKED (mecanismo verificado local 09.5A)

RESTORE_OR_REBUILD:
BLOCKED (mecanismo verificado local 09.5A)

ROLLBACK:
BLOCKED_BY_NO_PRIOR_ARTIFACT (mecanismo documentado)

EXTERNAL SIDE EFFECTS:
SANDBOXED_OR_DISABLED

CERTIFICATION PERSISTS RESTART:
YES

FINGERPRINT CHANGE REQUIRES REQUALIFICATION:
YES

HISTORICAL SQL CREDENTIAL ROTATION:
STILL_REQUIRED

PRODUCTION OPERATIONAL READINESS:
BLOCKED

CLINICAL PRODUCTION RELEASE GATE:
NOT_READY

API TESTS:
1130/1184 (54 skipped)

FRONTEND TESTS:
1994/1995 (1 skipped)

LINT:
PASS (0 errores, 9 warnings pre-existentes)

TYPECHECK:
PASS

BUILD:
PASS

TRACKED CONFIRMED SECRETS:
0

WORKTREE CLEAN:
YES (tras commit de documentación)

## Next Step

CASE A — REAL STAGING = BLOCKED.

La única acción recomendada: la infraestructura/operador concreta requerida
para crear staging real, según `docs/operations/staging-infrastructure-
requirements.md` (matriz §3 + bloqueadores §4 + acciones §5): autorizar
proveedor, provisionar host API + host frontend + 2 BDs SQL separadas +
storage de backups + DNS/TLS + secret store, rotar la credencial SQL
histórica, y ejecutar `docs/operations/staging-bring-up-runbook.md`.

NO se recomienda Build 09.5B (shadow profesional) hasta que exista staging
real y modelo eligible.