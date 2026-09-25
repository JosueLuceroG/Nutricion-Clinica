# AI Remediation Build 08 - DWH Analítico SQL Real + Fail-Closed + Allowlist

Fecha: 2026-08-19. Rama: `hardening/remediation-08` (sin push). Objetivo: DWH en
SQL Server real (bases desechables), ETL 8 pipelines, capa semántica con
métricas aprobadas, tools ALLOWLIST, narrativa AI abstiene sin modelo
APPROVED_ANALYTICS, reconciliación 0 pérdida, small-cell, alcance por token,
inyección de fallos — todo verificado contra SQL Server 2022 Express real y
regresiones completas.

## 1. Alcance y capas

- DWH separado de OLTP (fail-closed vía `assertDwhDatabaseSeparate`: misma DB => throw).
- Migraciones 001-037 inmutables (runner aplica 37/37 en DB fresca).
- Schema DWH `dwh-08-002` aplicado por `applyDwhSchema` (idempotente, tolerante a
  primera ejecución sin tabla de versiones).
- ETL 8 pipelines (dim_sucursal/dim_professional/dim_patient SCD2 + 5 facts),
  watermarks, carga completa + incremental + late-arriving + soft-delete,
  reconciliación por pipeline, rejects tipificados.
- Capa semántica: catálogo (métricas aprobadas vs financieras METRIC_NOT_APPROVED),
  metricService = ÚNICO traductor métrica->SQL, dims/facts desde catálogo.
- Tools analytics ALLOWLIST (9 tools): el LLM nunca genera SQL; inputs tipados;
  evidencia DWH determinista (sourceType DWH, metricId/version, período,
  loadRunId, reconciliationStatus, observedAt).
- Narrativa AI: ABSTIENE sin modelo `APPROVED_ANALYTICS` + capability
  `dashboard_analytics` (ningún seed certificado => `AI_ABSTAINED`/`NO_ELIGIBLE_MODEL`).
- Egress `ANALYTICS_AGGREGATE` aditivo (sin PHI). Small-cell default 5.

## 2. Esquema DWH - dwh-08-002

- `dwh_schema_version` con checksum; `applyDwhSchema` = idempotente (batch
  completo por versión) + drift check si la versión ya existe.
- `dwh-08-001 -> dwh-08-002`: `fact_adherence.meals_logged NVARCHAR(2000) NULL`
  (OLTP `adherence_records.meals_logged` es NVARCHAR(2000) NOT NULL DEFAULT '').
- Tablas: dim_sucursal/dim_professional/dim_patient (SCD2 + is_current),
  dim_date (2020-01-01..2030-12-31 = 4018 filas), fact_consultation,
  fact_anthropometry, fact_meal_plan, fact_lab, fact_adherence,
  dwh_watermarks, dwh_load_runs, dwh_reconciliation, dwh_rejects,
  dwh_pipeline_locks.
- First-apply seguro: la verificación de drift solo consulta
  `dwh_schema_version` cuando ya existe (fresh DB no falla).

## 3. ETL - hallazgos de ejecución real (esta sesión)

1. **GUID byte-order (crítico)**: SQL Server almacena uniqueidentifier
   little-endian. Insertar GUIDs como literales binarios `0x...` produce
   GUIDs invertidos en DWH (fact_consultation mostraba `000000C0-...`).
   Fix: `binSql()` genera `CONVERT(uniqueidentifier, N'<dashed>')` para facts.
   Las dims ya eran correctas (parámetros tipados `sql.UniqueIdentifier`).
2. **toGuidParam**: mssql v11 rechaza Buffer para UniqueIdentifier
   ("Invalid string") => retorna GUID con guiones.
3. **Conteo de MERGE**: `rowsAffected` es el total; no permite derivar
   inserted vs updated. Fix: `OUTPUT $action AS act` y conteo por acción.
4. **adherence sin profesional_id**: `adherence_records` no tiene la columna;
   el extract hace `LEFT JOIN consultas` para `c.profesional_id`; NULL =>
   FactRowReject `unknown_dimension` (fail-closed).
5. **fact_lab**: `results_json` puede ser array u objeto (`{"glucosa":92}`);
   `'not-json'` => `invalid_lab_json`, `'{}'` => `no_observations`.
6. **Watermark nunca NULL**: extract vacío en primera carga =>
   `watermarkParam(null)` = 2000-01-01 (columna NOT NULL).
7. **Inyección de fallos**: mensaje `INYECTADO: inyección de fallo (pipeline)
   tras extracción`; el watermark NO avanza y la recuperación sin inyección
   completa la carga (verificado en SQL real).

## 4. Suite real SQL - 17 tests (gate `AI_REAL_SQL_TEST=1`)

Ejecutado por `scripts/verify-dwh-b08.ps1` (login `nc_b08_ci` + bases
desechables `nc_b08_oltp`/`nc_b08_dw`, migración 37/37, limpieza al cierre):

| Test | Resultado |
|---|---|
| schema dwh-08-002 + tablas | PASS |
| dim_date 4018 filas | PASS |
| CARGA FRESCA dims/facts (25/4/5/3/6; dims 2/3/9) | PASS |
| IDEMPOTENCIA (segunda carga completa no duplica, watermarks no regresan) | PASS |
| INCREMENTAL + LATE-ARRIVING + SOFT-DELETE (26/1) | PASS |
| REJECTS (invalid_lab_json + no_observations en dwh_rejects) | PASS |
| RECONCILIACIÓN UNEXPECTED LOSS = 0 en todos los pipelines | PASS |
| MÉTRICAS E2E (11/14, new 6/2, patient_count 6, adherence 4/75, meal 3/2, lab 2/1, avg 12.5) | PASS |
| TOOLS E2E (volume 25 [11,14], growth -4/-66.7, breakdown 23/2, get_metric evidencia, freshness, financial => METRIC_NOT_APPROVED) | PASS |
| COMPARE PERIODS sin previo (priorAbsent, deltaAbs 14, sin div/0) | PASS |
| SCOPE REAL (nutriologa sucursal 23 vs admin 25) | PASS |
| FAILURE INJECTION (fail tras extract, watermark NO avanza, recupera) | PASS |
| NARRATIVA (números 200 OK; AI_ABSTAINED/NO_ELIGIBLE_MODEL) | PASS |
| SMALL-CELL (S2 con 3 => -1 con umbral 5, suppressedCells 1) | PASS |
| AUTHZ REAL (resolveScope desde token) | PASS |
| SECRET SCAN de fixture (0 secretos reales) | PASS |

Resultado final: **17/17 PASS** (run final `dwh-b08-run14.txt`).

## 5. Bugs encontrados y corregidos en la suite (capa semántica)

1. **metricService grouped query**: `String.replace` solo reemplazaba la PRIMERA
   ocurrencia => `fact_consultation.is_deleted could not be bound`. Fix:
   `replaceAll`. Además baseWhere/scopeWhere ahora prefijan siempre tabla.
2. **GROUP BY incompleto**: `dim_sucursal.nombre` fuera del GROUP BY. Fix:
   groupByExpr incluye clave + label (month agrupa por year_key, month_key).
3. **avg_consultations_per_period rota**: faltaba en `PIPELINE_BY_METRIC`
   (=> pipelineId undefined => parámetro NULL => DWH_NOT_READY) y en
   `FACT_BY_METRIC` (=> TypeError). Nunca cubierta en unit tests. Fix: ambas
   entradas => fact_consultation. Verificado con harness de debug + sonda.
4. **data_freshness**: derivaba pipelines de `dwh_pipeline_locks` (vacío tras
   release). Fix: `SELECT DISTINCT pipeline_id FROM dwh_load_runs`.
5. **parseMetricId**: rechazaba métricas registradas-no-aprobadas con throw.
   Contrato Build 08: métricas financieras => resultado `METRIC_NOT_APPROVED`
   (nunca número inventado). Fix: valida `getMetricDefinition`; unit test
   alineado (ahora verifica status METRIC_NOT_APPROVED para revenue).
6. **sucursal_key no determinista**: IDENTITY sobre extract sin ORDER BY
   (PK uniqueidentifier) => el test SMALL-CELL buscaba por `key !== '1'`.
   Fix: buscar por label `'Sucursal Dos B08'`.

## 6. Reconciliación

Cada pipeline registra `dwh_reconciliation` (source_expected = loaded +
filtered + rejected; unexpected_loss). Gate de métricas: si la última
reconciliación tiene pérdida => `FAILED_RECONCILIATION` (nunca número).
En la suite real: **8 pipelines, unexpected_loss = 0** en todos.

## 7. Métricas aprobadas vs financieras

- Aprobadas: consultation_count, patient_count, new_patients,
  avg_consultations_per_period, anthropometry_volume, lab_observation_volume,
  meal_plan_volume, adherence_population_summary.
- `revenue`, `collections`, `outstanding_balance` => METRIC_NOT_APPROVED
  (source-of-truth financiero no resuelto). El LLM nunca define números:
  el valor viene exclusivamente de la capa semántica.

## 8. Evidencia y narrativa

- `dwhEvidenceItem`: claimType OBSERVED_TREND, sourceType DWH, metricId,
  metricVersion, period, loadRunId, reconciliationStatus, observedAt.
- Narrativa: sin modelo con capability `dashboard_analytics` =>
  `AI_ABSTAINED` (reason NO_ELIGIBLE_MODEL); los números del dashboard
  siguen 200 OK (no dependen del LLM).

## 9. Harness de debug (removido)

`etl.debug.test.ts` + `scripts/dbg-dwh.ps1` (temporales, NO commiteados)
aislaron: dim_sucursal GUID param, MERGE fact, incremental soft-delete,
sonda AVG (dim_date vacía en debug => JOIN 0 filas) y AVG_FULL (reprodujo
DWH_NOT_READY). Ambos eliminados antes del commit final; bases `nc_b08_dbg_*`
y logs temp borrados.

## 10. Regresiones completas

- API: **1022 passed + 40 skipped** (135 archivos, 132 pasados; +17 skipped =
  suite real SQL gateada por `AI_REAL_SQL_TEST`).
- Frontend: **1994 passed + 1 skipped** (149 archivos).
- Lint: **0 errores** (9 warnings preexistentes react-refresh/hooks).
- Typecheck: **0 errores** (api + web build PASS).
- Build: PASS (api `tsc`; web `tsc -b && vite build`).
- Secret scan (`git grep` de contraseña/PRIVATE KEY): **0 hallazgos**.

## 11. Bloqueadores externos (sin cambio)

1. STAGING NOT_AVAILABLE => DWH GATE BLOCKED hasta disponibilidad.
2. HISTORICAL SQL CREDENTIAL ROTATION: STILL_REQUIRED (operador; el valor
   nunca se solicita/despliega).
3. PROFESSIONAL CLINICAL VALIDATION: NOT_DONE.
4. PRODUCTION CLINICAL CERTIFICATION: NOT_GRANTED.
5. SQL DWH CI: DEFERRED (runner con `AI_REAL_SQL_TEST=1` + DB desechable).

## 12. Cierre

- DBs/login desechables `nc_b08_*` borrados al cierre (script `finally`).
- Artefactos de debug (`etl.debug.test.ts`, `dbg-dwh.ps1`, logs) eliminados.
- Commits en `hardening/remediation-08`, sin push.

```text
FINAL GATE BLOCK - REMEDIATION BUILD 08
=======================================
REAL SQL DWH: PASS (17/17 en nc_b08_oltp/nc_b08_dw desechables)
ETL PIPELINES: PASS (8/8, reconciliación 0 pérdida, rejects tipificados)
SEMANTIC LAYER: PASS (métricas aprobadas; financieras METRIC_NOT_APPROVED)
TOOLS ALLOWLIST: PASS (9 tools, sin SQL del LLM, evidencia DWH determinista)
AI NARRATIVE: PASS (ABSTIENE sin APPROVED_ANALYTICS; números 200 OK)
SMALL-CELL: PASS (umbral 5, suppression -1, suppressedCells contados)
SCOPE/AUTHZ: PASS (sucursal por token; admin global)
FAILURE INJECTION: PASS (watermark no avanza, recupera)
SECRET SCAN: 0 hallazgos
API TESTS: 1022 passed + 40 skipped
FRONTEND TESTS: 1994 passed + 1 skipped
LINT/TYPECHECK/BUILD: 0 errores / 0 errores / PASS
HISTORICAL SQL CREDENTIAL ROTATION: STILL_REQUIRED (operador)
PROFESSIONAL CLINICAL VALIDATION: NOT_DONE
PRODUCTION CLINICAL CERTIFICATION: NOT_GRANTED
STAGING DWH GATE: BLOCKED (no hay staging real)
SQL DWH CI: DEFERRED
WORKTREE: pendiente commit de este reporte
=======================================
GATE: PASS condicional (bloqueadores externos reportados como están)
```

## 13. NEXT

- Build 09 = observabilidad (métricas de pipeline/ejecución) + shadow-validation
  de narrativa. NO ejecutar automáticamente; requiere instrucción explícita.