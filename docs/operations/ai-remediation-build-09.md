# AI Remediation Build 09 - Observabilidad + Telemetria + Shadow Validation (Readiness)

Fecha: 2026-08-20. Rama: `hardening/remediation-09` (sin push). Objetivo:
telemetria estructurada vendor-neutral (observabilidad != auditoria), health
model, alerting, shadow clinical validation READINESS (NUNCA produccion
clinica), todo verificado contra SQL Server real (migracion 038) y regresiones
completas.

## 1. Alcance y capas

- `apps/api/src/modules/observability/`: tipos de eventos, guard PHI, store
  dual (memory por default / sql por `AI_TELEMETRY_STORE`), agregador en
  memoria (counters + latencia p50/p95 + estados de breaker), facade fail-soft,
  health model, alerting deterministico, retencion, access control, rutas
  `/observability`.
- `apps/api/src/modules/shadow/`: maquina de estados (transiciones del
  servidor, auditadas), prerequisitos (readiness machine-readable), muestreo
  deterministico (hash), gate de modelos fail-closed, contrato de revision
  profesional, auto-disable zero-tolerance, runner con version pinning, rutas
  `/shadow` (admin/auditor/soporte_tecnico).
- Instrumentacion: `aiOrchestrator` (started/completed/abstained/denied/failed
  con latency + counts por intento), `modelCircuitBreaker` (breaker.transition
  CLOSED/OPEN/HALF_OPEN), `toolExecutionService` (tool.invocation),
  RAG (`rag.retrieval`/`rag.citation`/`rag.grounding`), memoria
  (`memory.access`), DWH (`dwh.etl` con loadRunId + reconciliation),
  analytics (`analytics.query`), `ai/numericContradiction.ts`
  (NUMERIC_CONTRADICTION).
- Migracion `038-telemetry.sql` (aditiva, IF NOT EXISTS + GO, checksum sha256):
  `ai_telemetry_events`, `ai_telemetry_aggregates`, `ai_telemetry_alerts`,
  `shadow_state`, `shadow_runs`, `shadow_reviews`, `shadow_auto_disable_events`,
  `shadow_cohorts`. 001-037 inmutables.

## 2. Observabilidad vs auditoria

- AUDIT (existente, no tocado): WHO/WHAT/WHEN via `audit_log` (fail-closed).
- TELEMETRY (nuevo): HOW (latencia, tasa, estados). Fail-soft por diseno: un
  fallo de telemetria nunca rompe el flujo de negocio y NUNCA condiciona la
  llamada al provider. La auditoria obligatoria NO se sustituye por telemetria.
- PHI: eventos sin nombre/email/telefono/direccion/nota/prompt crudo/payload de
  lab/plan/chunks/credenciales. Solo executionId/correlationId/attemptId/
  toolCallId/retrievalId/shadowRunId/loadRunId + dimensiones seguras. Guard
  `assertNoPhiFields` lanza antes de persistir (fail-closed en privacidad).
- Dedup: eventos terminales por executionId (guard en memoria + `WHERE NOT
  EXISTS` en SQL, TTL 1h) => sin doble conteo.
- Bounds: `AI_TELEMETRY_MAX_EVENT_BYTES` (2048) descarta payloads inflados.

## 3. Agregacion y percentiles

- p50/p95 SOLO con `AI_TELEMETRY_PERCENTILE_MIN_SAMPLES` (default 5): nunca se
  fabrica un percentil con una observacion (verificado en unit tests).
- Counters por dimension `eventType.provider.model.capability` + status.
- Breakers: estado agregado CLOSED/OPEN/HALF_OPEN con categoria de razon.
- Flush a `ai_telemetry_aggregates` con MERGE (count acumula; p50/p95/last
  reemplazan) - validado contra SQL Server real (el primer intento con dos
  clausulas `WHEN MATCHED` fue rechazado por SQL Server; fix con CASE).

## 4. Health model

- `GET /observability/health` (roles admin/auditor/soporte_tecnico):
  infrastructure HEALTHY/DEGRADED/UNAVAILABLE/BLOCKED/UNKNOWN separado de
  clinicalModelAvailability: `NO_ELIGIBLE_MODEL` NO es caida de infraestructura
  (modelo clinico elegible: NONE). Kill switches se muestran como estado,
  nunca se sobreescriben.

## 5. Alerting

- Reglas deterministas configurables: breaker abierto (CRITICAL), spike de
  fallos de schema, colapso de validez de citas, DWH load fallido,
  eventos UNSAFE, recuperacion no autorizada, desacuerdo critico de shadow.
- Persistencia en `ai_telemetry_alerts` con dedup 1/hora por regla
  (verificado en SQL real).

## 6. Retencion

- `AI_TELEMETRY_RETENTION_RAW_DAYS` (7), `_AGG_DAYS` (90),
  `_ALERT_DAYS` (30): valores operativos configurables, sin requisitos legales
  inventados. Purge SQL validado en SQL real.

## 7. Shadow - estados y transiciones (server-controlled)

- `DISABLED` (default) / `TECHNICAL_TEST_ONLY` / `READY_FOR_PROFESSIONAL_SHADOW`
  / `ACTIVE_PROFESSIONAL_SHADOW` / `PAUSED` / `AUTO_DISABLED` (solo automatica,
  nunca se revierte sola) / `COMPLETED` (final). Transiciones manuales
  restringidas; cada transicion es auditable.

## 8. Shadow - prerequisitos y readiness (BLOCKED honesto)

- `evaluateShadowPrerequisites`: modelo clinico elegible, staging, pool de
  revisores, estado configurado, infraestructura. Machine-readable: `BLOCKED`
  (estado actual real: sin modelo clinico elegible + sin staging).
- `NO_ELIGIBLE_MODEL !=` infraestructura caida: reporte separado.

## 9. Shadow - gate de modelos (fail-closed)

- Sin modelo calificado => `DENIED_NO_ELIGIBLE_MODEL` (BLOCKED).
- Modelo no elegible (p.ej. llama3.2) => `DENIED_MODEL_NOT_ELIGIBLE_FOR_SHADOW`
  con 0 llamadas a provider (verificado en tests).
- `SHADOW_TEST_QUALIFIED_*` = GOLDEN falso deterministico: demuestra el camino
  tecnico (runner `COMPLETED` engine GOLDEN) sin riesgo clinico.

## 10. Shadow - runner y version pinning

- Muestreo deterministico (`AI_SHADOW_SAMPLE_RATE`, 0.0 default): misma
  executionId => misma decision.
- `version_bundle` = prompt + toolset + policy + schema + knowledge + memory +
  catalog + eval dataset (pin por cohorte `shadow_cohorts`).
- Output del shadow: descartable; nunca llega al paciente, nunca persiste
  verdad clinica, nunca dispara acciones, no hay cadenas de agentes.
- Feedback de revision NUNCA es dato de entrenamiento automatico.

## 11. Shadow - contrato de revision y auto-disable

- Etiquetas fijas: ACCEPTED / ACCEPTED_WITH_EDITS / REJECTED / UNSAFE /
  INCORRECT / MISSING_DATA / BAD_EVIDENCE / BAD_CITATION /
  INAPPROPRIATE_ABSTENTION / SHOULD_HAVE_ABSTAINED.
- `criticalDisagreement` separado de desacuerdo ordinario; ACCEPTED !=
  correccion cientifica. Comentarios libres permanecen en el dominio protegido
  de revision (nunca a telemetria).
- Auto-disable: zero-tolerance (UNSAFE, desacuerdo critico,
  SHOULD_HAVE_ABSTAINED) + colapso de citas + acuerdo minimo, con muestra
  minima configurable (`AI_SHADOW_AUTODISABLE_*`, ningun umbral inventado
  como validado clinicamente). Solo transiciona a AUTO_DISABLED.

## 12. Suite real SQL - 9 tests (gate `AI_REAL_SQL_TEST=1`)

Ejecutado por `scripts/verify-telemetry-b09.ps1` (login `nc_b09_ci` + base
desechable `nc_b09_oltp`, migraciones 38/38 frescas, limpieza al cierre):

| Test | Resultado |
|---|---|
| Migracion 038 aplicada: 8 tablas existen (telemetria + shadow) | PASS |
| Runner registra 038 en schema_migrations (checksum sha256) | PASS |
| Store SQL: inserta evento + dedup terminal por executionId | PASS |
| Store SQL: MERGE de agregados (count acumula, p50 reemplaza) | PASS |
| Retencion: purge valido y no borra reciente | PASS |
| Alertas: persisten con dedup 1/hora por regla | PASS |
| Tablas de shadow: cohorte, run y revision con FK | PASS |
| Auto-disable + estados: contratos inmutables | PASS |
| SECRET SCAN de fixture (0 secretos reales) | PASS |

Resultado final: **9/9 PASS**.

## 13. Regresiones completas

- API: **1061 passed + 49 skipped** (135 archivos pasados + 4 skipped; +39
  tests nuevos Build 09; skipped = suites gateadas por `AI_REAL_SQL_TEST`:
  17 etl b08 + 18 erpTools b07.5 + 5 build07Stores + 9 telemetry b09).
- Frontend: **1994 passed + 1 skipped** (149 archivos).
- Lint: **0 errores** (9 warnings preexistentes react-refresh/hooks).
- Typecheck: **0 errores** (api + web build PASS).
- Build: PASS (api `tsc`; web `tsc -b && vite build`).
- Secret scan (`git grep` de contrasena/PRIVATE KEY): **0 hallazgos**.

## 14. Bloqueadores externos (sin cambio)

1. REAL STAGING NOT_AVAILABLE => shadow profesional BLOCKED.
2. HISTORICAL SQL CREDENTIAL ROTATION: STILL_REQUIRED (operador; el valor
   nunca se solicita/despliega).
3. PROFESSIONAL CLINICAL VALIDATION: NOT_DONE.
4. PRODUCTION CLINICAL CERTIFICATION: NOT_GRANTED.
5. SQL real CI: DEFERRED (runner con `AI_REAL_SQL_TEST=1` + DB desechable).

## 15. Cierre

- DB/login desechable `nc_b09_*` borrados al cierre (script `finally`).
- Migraciones 001-037 intactas (038 aditiva, sin modificaciones a OLTP/DWH).
- Commits en `hardening/remediation-09`, sin push.

```text
FINAL GATE BLOCK - REMEDIATION BUILD 09
=======================================
OBSERVABILITY CORE: PASS (telemetria sin PHI, fail-soft, dedup terminal)
AGGREGATES: PASS (p50/p95 solo con muestra minima; MERGE validado en SQL real)
HEALTH MODEL: PASS (infra separada de disponibilidad de modelo clinico)
ALERTING: PASS (reglas deterministicas, dedup 1/hora)
RETENTION: PASS (configurable, purge SQL validado)
SHADOW STATE MACHINE: PASS (server-controlled, AUTO_DISABLED irreversible)
SHADOW READINESS: PASS (machine-readable BLOCKED: sin modelo elegible ni staging)
SHADOW GATE: PASS (fail-closed; llama3.2 => DENIED con 0 llamadas al provider)
SHADOW RUNNER: PASS (GOLDEN deterministico, version pinning, sin PHI)
SHADOW REVIEW: PASS (etiquetas fijas, criticalDisagreement separado)
SHADOW AUTO-DISABLE: PASS (zero-tolerance, muestra minima configurable)
REAL SQL (038): PASS (9/9 en nc_b09_oltp desechable)
SECRET SCAN: 0 hallazgos
API TESTS: 1061 passed + 49 skipped
FRONTEND TESTS: 1994 passed + 1 skipped
LINT/TYPECHECK/BUILD: 0 errores / 0 errores / PASS
REAL STAGING: NOT_AVAILABLE (shadow profesional BLOCKED)
HISTORICAL SQL CREDENTIAL ROTATION: STILL_REQUIRED (operador)
PROFESSIONAL CLINICAL VALIDATION: NOT_DONE
PRODUCTION CLINICAL CERTIFICATION: NOT_GRANTED
CLINICAL PRODUCTION RELEASE GATE: NOT_READY
SQL real CI: DEFERRED
WORKTREE: pendiente commit de este reporte
=======================================
GATE: PASS condicional (bloqueadores externos reportados como estan)
```

## 16. NEXT

- REMEDIATION BUILD 09.5 OPERATIONAL READINESS: staging real + modelo clinico
  elegible + shadow profesional pilot (prerequisitos actuales: sin modelo
  elegible, sin staging, validacion profesional no hecha). NO ejecutar
  automaticamente; requiere instruccion explicita. NO habilitar Patient AI en
  produccion.