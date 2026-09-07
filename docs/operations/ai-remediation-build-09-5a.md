# AI Remediation Build 09.5A - Operational Readiness + Deployment Safety + Certification Persistence + Shadow Pilot Prerequisites

Fecha: 2026-08-20. Rama: `hardening/remediation-09-5a` (sin push). Objetivo:
readiness operativo (identidad de despliegue, pre-deploy gate, feature flags,
saneamiento), persistencia de certificación clínica (migración 039,
fail-closed, fingerprint), guards destructivos (target guard, startup
fail-fast, staging reset) y prerequisitos del piloto de shadow 09.5B — SIN
validación clínica profesional, SIN aprobar modelos fallidos, SIN habilitar
Patient AI, SIN reabrir el torneo, SIN tocar producción.

## 1. Alcance y capas

- `apps/api/src/modules/deployment/`: `environmentIdentity.ts` (clases de
  entorno, commit, gitBranch, targets), `targetGuard.ts` (acciones
  destructivas fail-closed), `startupValidation.ts` (config válida de
  arranque, fail-fast), `deploymentManifest.ts` (manifiesto trazable),
  `featureFlags.ts` (kill switches con defaults seguros),
  `preDeployGate.ts` (Tier A código + Tier B externo PENDING_EXTERNAL),
  `releaseGate.ts` (grupos SECURITY/DATA/DEPLOYMENT/MODEL/STAGING/SHADOW/
  PROFESSIONAL_VALIDATION/CLINICAL_CERTIFICATION/KILL_SWITCH),
  `sanitize.ts` (redacción de secretos, mensajes genéricos fuera de
  LOCAL/TEST), `deploymentRoutes.ts` (rutas `/deployment`).
- `apps/api/src/modules/ai/certification/certificationPersistence.ts`:
  stores `memory`/`sql` + `initializeCertificationPersistence` (carga
  fail-fast). `clinicalCertification.ts`: fingerprint de despliegue en la
  clave de certificación, `DEFAULT_REQUALIFICATION_FLAGS` (torneo 07.5A),
  `replaceAll`, `clearRequalificationRequired`, `listRequalificationFlags`.
- `apps/api/src/modules/shadow/`: `shadowPilotConfig.ts`, `reviewerScope.ts`,
  `governanceConfig.ts` y `shadowPrerequisites.ts` reescrito (prerequisitos
  §61 completos, técnico GOLDEN = n/a).
- `apps/api/src/db/stagingReset.ts` + script `reset:staging`; guards en
  `migrate.ts`/`seed.ts`; `server.ts` con validación de arranque + CORS +
  bootstrap async de persistencia; `middleware/errorHandler.ts` saneado.
- Migración `039-deployment-certification-persistence.sql` (aditiva):
  `ai_certification_records` (record_json + columnas índice) y
  `ai_requalification_flags` (PK provider/model/capability) + INSERT base de
  flags del torneo 07.5A (idempotente). 001-038 inmutables.

## 2. Identity de despliegue y clases de entorno

- `ENVIRONMENT_CLASS`: LOCAL | TEST | STAGING | PRODUCTION. Default LOCAL;
  con `NODE_ENV=production` y sin clase explícita => UNKNOWN => arranque
  fail-closed (`assertStartupConfigValid` lanza; el servidor no arranca).
- `INSTANCE_ID`, `RELEASE_VERSION`: trazabilidad del manifiesto. El manifiesto
  incluye release, commit, esquema OLTP (última migración del repo = 039),
  esquema DWH, catálogo semántico, políticas, toolset, bundle de prompts
  (hash determinista) y versión frontend. NUNCA incluye secretos.
- STAGING/PRODUCTION exigen `DB_NAME` y `DWH_DATABASE` explícitos, distintos
  entre sí y de los defaults locales (`nutriclinica`/`nutriclinicadw`), y
  `CORS_ORIGIN` sin comodines. PRODUCTION no puede usar contraseña vacía.

## 3. Persistencia de certificación (migración 039) — cierre del gap

- La BD es la fuente de verdad: `AI_CERTIFICATION_STORE=sql` carga registros y
  flags al arranque (`initializeCertificationPersistence`); si la carga
  falla, el arranque falla (fail-fast). Vacío/ausente = NOT_ELIGIBLE (nunca
  aprobación por defecto). `memory` = no persiste (default, sin cambio).
- `deploymentFingerprint` en la clave: un despliegue con fingerprint distinto
  al del registro => stale + REQUALIFICATION_REQUIRED (nunca se re-certifica
  en caliente). `localAutoRuntime` propaga el fingerprint del despliegue.
- `DEFAULT_REQUALIFICATION_FLAGS` (código + baseline en 039):
  `ollama/llama3.2`: chat_general, nutrition_reasoning;
  `openai/gpt-4o-mini`: chat_general, structured_json, nutrition_reasoning
  (torneo 07.5A: llama3.2 6/8 FAIL, gpt-4o-mini 4/8 FAIL). gpt-4o SIN flag
  (sin evidencia nueva). El constructor los aplica por defecto; el operador
  puede agregar/refrescar bloqueos vía
  `POST /deployment/certification/requalify` (admin-only) y registrar solo
  resultados no aprobados con evidencia vía
  `POST /deployment/certification/register`.
- Los tests de happy-path de gateway/orquestador usan clear/restore de flags
  sobre el registry global (los defaults siguen bloqueando en producción).

## 4. Pre-deploy gate

- Tier A (código): worktree limpio, release trazable, config válida, flags
  seguros, scan de secretos (git ls-files, claves estilo env, valores no
  placeholder, sin comentarios; 0 hallazgos), manifiesto completo, kill
  switch conocido.
- Tier B (externo): pending_migrations, backup_available, rollback_artifact,
  staging_smoke => SIEMPRE `PENDING_EXTERNAL` (nunca se finge verificación
  sin infraestructura real). `deployableToStaging` solo si todo es PASS.

## 5. Feature flags y kill switches

- `AI_EGRESS_ENABLED` (egreso AI), `AI_SHADOW_STATE` (estado shadow),
  `AI_PATIENT_ENABLED` (Patient AI): defaults apagados; entorno UNKNOWN los
  fuerza apagados. Egreso apagado => 503 `AI_DISABLED` y cero llamadas al
  provider (E2E verificado).

## 6. Saneamiento de errores

- `errorHandler`: mensajes genéricos (`nutriclinica-REDACTED`) en
  STAGING/PRODUCTION/UNKNOWN; en LOCAL/TEST mensajes de dominio saneados
  (sin secretos). `details` estructurados conservan forma pero se redactan
  secretos. Logs del servidor redactados fuera de LOCAL/TEST. E2E de fuga
  PHI/secretos: ni nombres de paciente ni claves llegan al cliente.

## 7. Shadow pilot 09.5B — prerequisitos (§61)

- Estado: DISABLED (default) | TECHNICAL_TEST_ONLY | READY_FOR_PROFESSIONAL_SHADOW
  | ACTIVE_PROFESSIONAL_SHADOW | PAUSED | AUTO_DISABLED | COMPLETED. Técnico =
  GOLDEN de ingeniería (camino no clínico; las
  certificaciones clínicas cuentan n/a). Profesional exige TODOS:
  entorno válido, staging disponible, modelo elegible, certificación vigente
  (sin REQUALIFICATION_REQUIRED), egreso aprobado, consentimiento
  `declared_ready`, revisores con scopes (sin cross-tenant), estado
  configurado, observabilidad, kill switch, rollback (`SHADOW_ROLLBACK_VERIFIED`
  =true) y backup (`SHADOW_BACKUP_VERIFIED`=true), umbrales del contrato
  (capabilities/riesgos/roles/muestreo/ventanas + zero-tolerance).
- Estado actual real: `BLOCKED_BY_MODEL` (ningún modelo clínico elegible) +
  STAGING NOT_AVAILABLE. El gate nunca se salta.

## 8. Guards destructivos

- `assertTargetSafe`: migrate/seed/reset/rebuild/drop en PRODUCTION exigen
  `ALLOW_PRODUCTION_*`; UNKNOWN siempre falla; STAGING no puede apuntar a
  bases default ni mezclar OLTP/DWH. `reset:staging` solo toca tablas
  sintéticas (TRUNCATE, nunca DROP, nunca tablas clínicas).
- `server.ts`: `assertStartupConfigValid` al importar (fail-fast antes de
  escuchar) + rechazo de CORS comodín en STAGING/PRODUCTION + bootstrap async
  de persistencia de certificación. Los tests nunca importan `server.ts`.

## 9. Rutas /deployment

- GET `/identity`, `/manifest`, `/predeploy`, `/release-gate`, `/flags`,
  `/readiness`, `/certification`; POST `/certification/requalify` y
  `/certification/register` (admin-only). Las mutaciones requieren escritura de
  auditoría previa; el registro acepta solo estados no aprobados, el fingerprint
  GOLDEN vigente, un `reportRef` ligado a SHA-256 y un `certificationId`
  inmutable. Respuestas saneadas, sin secretos. Los estados `APPROVED_*`
  requieren un pipeline de aprobación independiente que todavía no está
  implementado.

## 10. Runbooks operativos

### R01 — Rotación de credenciales SQL (pendiente: operador)

1. Crear nuevo login (`CREATE LOGIN` con contraseña fuerte, CHECK_POLICY=ON).
2. Transferir permisos: `ALTER AUTHORIZATION` por base + `ALTER ROLE`.
3. Cambiar `.env` del API (DB_USER/DB_PASSWORD) y reiniciar el servicio.
4. Revocar el login viejo tras 1 semana de supervisión (retorno limpio).
5. Marcar el reporte: `HISTORICAL SQL CREDENTIAL ROTATION: VERIFIED_BY_OPERATOR`.
   Hasta entonces: `STILL_REQUIRED`. NUNCA pedir ni registrar la contraseña.

### R02 — Backup / restore / DR

1. Backup diario full con CHECKSUM + verificación `RESTORE VERIFYONLY`.
2. Restore de prueba trimestral en base desechable (el runbook
   `verify-deployment-b09-5a.ps1` automatiza BACKUP/RESTORE roundtrip).
3. DR: restaurar backup + `pnpm migrate` (idempotente, checksums en
   `schema_migrations`) + seed de fixtures NO en producción.
4. Criterio de éxito: tablas de certificación y flags presentes en la base
   restaurada (verificado por el script).

### R03 — Onboarding de modelo (certificación)

1. Evaluar contra el dataset GOLDEN (ai:evaluate); umbrales §63 (0 clínicos).
2. Registrar por HTTP únicamente resultados no aprobados con
   `POST /deployment/certification/register`, evidencia inmutable
   (`reportRef@sha256:...`) y fingerprint de despliegue. Un pipeline
   independiente deberá registrar cualquier estado `APPROVED_*`.
3. `POST /deployment/certification/requalify` solo agrega/refresca el bloqueo;
   nunca lo limpia ni aprueba un modelo.
4. El clear de requalification no está expuesto por HTTP. Hasta definir el
   procedimiento independiente de aprobación, el modelo sigue
   REQUALIFICATION_REQUIRED (fail-closed).

### R04 — Release

1. `evaluatePreDeployGate` (Tier A) + `evaluateReleaseGate` en el entorno.
2. `pnpm migrate` contra staging real (001-039, idempotente).
3. Smoke real en staging; si falla: revert del release (rollback = revert de
   git + `reset:staging` solo sintético; 039 es aditiva, sin DROP).
4. PRODUCTION: solo si release gate READY y rotación VERIFIED_BY_OPERATOR.

### R05 — Incidente

1. Detener egreso: `AI_EGRESS_ENABLED=false` (503 AI_DISABLED, fail-closed).
2. Shadow: `AI_SHADOW_STATE=AUTO_DISABLED` (irreversible por el servidor).
3. Revisar telemetría/alerts (sin PHI) + auditoría; nunca leer prompts crudos
   de paciente en producción.

### R06 — Fallo de modelo (timeouts/5xx/breaker)

1. El circuit breaker abre automáticamente (threshold/cooldown configurables);
   el fallback operativo re-gatea cada candidato.
2. Verificar `GET /observability/health`: infraestructura vs disponibilidad de
   modelo clínico (NO_ELIGIBLE_MODEL no es caída de infra).
3. Si el fallo es persistente: marcar requalification y pausar el modelo.

### R07 — Promoción staging → producción

1. Requisitos innegociables: release gate READY (STAGING PASS, MODEL READY,
   SHADOW READY, validación profesional hecha, certificación otorgada),
   rotación VERIFIED_BY_OPERATOR, backup restaurable verificado.
2. Hasta entonces: `CLINICAL PRODUCTION RELEASE GATE: NOT_READY` — reportado
   honestamente, nunca forzado.

## 11. Verificación SQL real (CI diferida)

`scripts/verify-deployment-b09-5a.ps1` (operador, contra SQL Server local):
fresh 001-039 en `nc_b09_oltp`, verificación de tablas 039 + flags base,
idempotencia (segundo migrate sin re-aplicar), BACKUP/RESTORE roundtrip,
DWH rebuild (`etl.realSql.test.ts`) y persistencia real
(`certification.realSql.test.ts`, gated con `AI_REAL_SQL_TEST=1`). Limpieza
total en `finally`. `SQL real CI: DEFERRED`.

## 12. Regresiones

- API: 1130 passed + 54 skipped (0 failed). Nuevos: environmentIdentity,
  startupValidation, deployment (manifest/flags/predeploy/releaseGate/sanitize),
  deployment E2E (kill switch, rollback, smoke, leaks PHI/secretos),
  certificationPersistence, shadowPilotConfig, certification.realSql (gated).
- Frontend: 1994 passed + 1 skipped (baseline exacta).
- Lint: 0 errores / 9 warnings (pre-existentes). Typecheck: PASS. Build: PASS.
- Secret scan (versionados): 0 hallazgos.

## 13. FINAL GATE BLOCK

```text
FINAL GATE BLOCK - REMEDIATION BUILD 09.5A
===========================================
OPERATIONAL READINESS: PASS (LOCAL: identidad, manifiesto, pre-deploy gate, flags, saneamiento, guards)
DEPLOYMENT MANIFEST: PASS (release/commit/esquemas/prompt bundle/frontend; sin secretos)
PRE-DEPLOY GATE: PASS (Tier A codigo; Tier B externo PENDING_EXTERNAL, nunca fingido)
SECRET SCAN: 0 hallazgos (solo archivos versionados)
CERTIFICATION PERSISTENCE: PASS (migracion 039 + stores memory/sql, fingerprint, fail-closed)
REQUALIFICATION FLAGS: PASS (llama3.2 y gpt-4o-mini REQUALIFICATION_REQUIRED; gpt-4o sin cambios)
ELIGIBLE MODEL: NONE (ningun modelo clinico elegible)
REAL STAGING: BLOCKED (STAGING NOT_AVAILABLE)
STAGING IS JUST LOCALHOST RENAMED: NO (STAGING exige DB_NAME/DWH_DATABASE explicitos y distintos)
HISTORICAL SQL CREDENTIAL ROTATION: STILL_REQUIRED (operador)
PROFESSIONAL CLINICAL VALIDATION: NOT_DONE (0 muestras)
SHADOW PROFESSIONAL: BLOCKED_BY_MODEL (prerequisitos machine-readable)
PRODUCTION CLINICAL CERTIFICATION: NOT_GRANTED
PATIENT AI: false (default seguro; gate bloqueado)
TOURNAMENT: no reabierto
CLINICAL PRODUCTION RELEASE GATE: NOT_READY
SQL real CI: DEFERRED (runbook verify-deployment-b09-5a.ps1)
API TESTS: 1130 passed + 54 skipped
FRONTEND TESTS: 1994 passed + 1 skipped
LINT/TYPECHECK/BUILD: 0 errores / PASS / PASS
WORKTREE: pendiente commit de este reporte
===========================================
GATE: PASS LOCAL / CONDITIONAL GLOBAL (bloqueadores externos reportados como estan)
```

## 14. NEXT

- REMEDIATION BUILD 09.5B (piloto profesional de shadow) SOLO si TODOS:
  REAL STAGING=PASS (staging real disponible), HISTORICAL SQL CREDENTIAL
  ROTATION=VERIFIED_BY_OPERATOR, ELIGIBLE MODEL != NONE, y SHADOW READY
  (machine-readable). Si falta alguno: ejecutar SOLO el prerequisito
  faltante, no el piloto. NO ejecutar automáticamente; requiere instrucción
  explícita. NO habilitar Patient AI en producción. NO reabrir el torneo.
