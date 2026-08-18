# REMEDIATION BUILD 06.1 — Reporte de cierre

Verificación de cierre del Build 06 sobre **SQL Server real** (base desechable),
con SMAE data-driven, certificación exacta extendida, frescura de datos y
requalificación técnica honesta. Sin staging disponible, sin tocar producción,
sin features nuevas.

## Alcance y reglas

- Rama: `hardening/remediation-06-1` (base: Build 06, commit `45e8f7d`). Sin push.
- Sin edición de migraciones 001–035; persistencia nueva solo vía `036` aditivo (no se requirió).
- Sin forzar 20/20 ni 21/21: los estados BLOCKED/ABSTAINED son el resultado honesto del sistema.
- Sin certificación clínica manual ni validación clínica profesional.

## 1. Infraestructura real (SQL Server 2022 Express)

- Instancia: `SistemasPC\SQLEXPRESS` (conexión `localhost\SQLEXPRESS`).
- Base desechable `nc_b061_tools` + login SQL `nc_b061_ci` (db_owner).
  Contraseña generada fuerte, guardada en temp, **nunca impresa ni commiteada**.
- Migraciones: **35/35 aplicadas, idempotentes** (2º run 0 errores), 58 tablas.
- Harness real (`realSqlFixture.ts`): fixture con UUIDs fijos (2 sucursales,
  2 profesionales, 3 pacientes, 4 consultas, antropometrías incl. una de
  400 días, labs, plan activo 1600 kcal, adherence, pago completado,
  medicamentos Metformina/Omeprazol, alergia Cacahuate, intolerancia Lactosa,
  historia clínica, documento, consentimientos reales A1/A2).

## 2. Errores reales encontrados y corregidos (solo aparecen contra SQL real)

| Bug | Falla | Fix |
|---|---|---|
| 5 executors (`get_medications`, `get_allergies`, `get_intolerances`, `get_diagnoses`, `get_documents`) filtraban `sucursal_id` en tablas sin esa columna | `Invalid column name 'sucursal_id'` en runtime | `PATIENT_ONLY_INPUT(pid)`; aislamiento tenant conservado vía `assertPatientInSucursal` |
| UUID de fixture `p0000…` | 'p' no es dígito hex | `d0000…001` |
| `pagos` sin `profesional_id` (NOT NULL) y `status='completado'` fuera del CHECK | violación de constraint | valores correctos del esquema |
| `'aa'.repeat(32)` sin interpolar en template string | SQL `Cannot call methods on varchar` | `${'aa'.repeat(32)}` |
| PS 5.1 sin `RandomNumberGenerator::Fill` | runtime .NET | `RNGCryptoServiceProvider` |

## 3. Herramientas ERP contra SQL real — 15/15 PASS

- Matriz **21/21 tools** ejecutan contra SQL real con datos de la sucursal correcta.
- Aislamiento multi-tenant (profesional A no ve paciente B; búsquedas por sucursal).
- Inyección SQL: zod → 400 en ids maliciosos; `search_patient` parametrizado.
- Resultados vacíos → `null`/`[]` sin error; frescura de antropometría (ventana 15d).
- Provenance (`source: erp`, query, retrievedAt), audit (toolId/profesionalId/sucursalId).
- Consentimiento real desde `consentimientos` (sin → 403, con → ok); rol asistente → 403;
  `AI_TOOLS_ENABLED=false` → 503; citas upcoming/pasadas; `get_diet` parsea `meals_json` real.

## 4. Matriz de capacidades nutricionales contra SQL real — 3/3 PASS (21 capacidades)

`MATRIX_RESULTS` (21 capacidades canónicas, paciente A1, datos reales):

```
prepareNutritionConsultation:SUCCESS:10f:REVIEW, summarizeNutritionHistory:SUCCESS:5f:no-review,
detectNutritionDataGaps:SUCCESS:1f:no-review, generateNutritionQuestions:SUCCESS:1f:REVIEW,
draftNutritionNote:SUCCESS:3f:REVIEW, analyzeAnthropometry:SUCCESS:5f:REVIEW,
analyzeAdherence:SUCCESS:3f:REVIEW, summarizeRelevantLabs:SUCCESS:1f:REVIEW,
analyzeNutritionEvolution:SUCCESS:1f:REVIEW, analyzeBodyComposition:SUCCESS:4f:REVIEW,
analyzeNutritionGoals:BLOCKED:0f:REVIEW, reviewDrugNutrientInteractions:SUCCESS:0f:REVIEW,
compareAgainstProtocol:ABSTAINED:4f:REVIEW, generatePatientEducation:SUCCESS:4f:REVIEW,
explainNutritionRecommendation:SUCCESS:5f:REVIEW, reviewMealPlan:SUCCESS:3f:REVIEW,
validateMealPlan:SUCCESS:3f:REVIEW, suggestFoodSubstitutions:SUCCESS:1f:REVIEW,
analyzeNutrientIntake:SUCCESS:2f:REVIEW, draftMealPlan:SUCCESS:0f:REVIEW,
detectPotentialNutritionRisks:SUCCESS:1f:REVIEW
```

- `analyzeNutritionGoals` → **BLOCKED** (sin fuente autoritativa, honesto).
- `compareAgainstProtocol` → **ABSTAINED** (RAG sin documentos: fail-closed correcto).
- Gaps reales detectados en paciente esparso (antropometría >180 días, sin labs, sin alergias).
- Interacciones fármaco-nutriente desde datos reales (Metformina): evidencia solo de
  `KNOWN_RULE_MATCH | NO_KNOWN_INTERACTION | NO_COVERAGE | INSUFFICIENT_DATA`, nunca invento del LLM.

## 5. SMAE data-driven + certificación exacta

- `smaeCatalog.ts`: catálogo 37 alimentos activos, fingerprint determinista
  `smae-catalog-<fnv8>` y versión de motor `smae-engine-v1`; motor
  (`smaeEngine.ts`) parametrizado por catálogo; `loadSmaeCatalog` permite
  extender sin tocar el motor (validado con un 38º alimento sintético).
- Fail-closed: ids/grupos/gramos/kcal/nombre inválidos y duplicados → throw.
- `smaeCatalog.test.ts` 7 tests; SMAE + certificación: **41/41 PASS**.
- Certificación: `smaeCatalogVersion` en `CurrentVersions`, `CertificationKey`
  y 9 seeds; campos opcionales ausentes = wildcard. Build 05 (catálogo v0) queda STALE.

## 6. Frescura de datos (anthropometryRecent)

- `computeFreshness` + `anthropometryIsRecent` (180 días) integrados en
  `buildDataGaps`: distingue `antropometría reciente` (ausente) vs
  `antropometría desactualizada (>180 días)` (vencida). Verificado contra SQL real.

## 7. Requalificación técnica (honesta)

- Comando oficial: `pnpm --filter @nutriclinica/api ai:evaluate` con
  `AI_EGRESS_ENABLED=true` y DB desechable (egress manifests reales).
- Golden dataset fingerprint: `nutrition-golden-v1-7390ccd7` **= frozen**
  → ninguna certificación se invalida por dataset.
- **ollama/llama3.2 (configuración servida): 5/8 casos (62.5%) — NO alcanza la barra dorada.**
  G001/G004/G005/G007/G008 PASS; G002/G003 abstention FAIL (inventa cifras);
  G006 FAIL. Reporte conservado: `reports/ollama-llama3.2-chat_general.json`.
- **openai/gpt-4o-mini: NO reevaluado** (no hay credencial OpenAI en el entorno).
  El archivo `openai-gpt-4o-mini-chat_general.json` generado en un primer intento
  fue **descartado**: sin credencial, el fallback ollama responde y etiquetarlo
  como gpt-4o-mini sería engañoso.
- Fix de tooling incluido: `evaluateModels.ts` ahora registra los providers
  igual que el runtime (`aiRoutes.ts`); antes siempre fallaba 502
  (`Provider not registered`).
- Model Card actualizada (ollama/llama3.2 → reporte nuevo de requalificación).

## 8. Regresiones completas

| Check | Resultado |
|---|---|
| API suite (vitest) | **117 passed + 1 skipped (118 files), 898 passed + 18 skipped (916 tests)** |
| Suite IA (sin env) | 644 passed + 18 skipped (85 files) — CI-safe |
| Suites real-SQL (con env) | **18/18 PASS** (15 tools + 3 matriz, un solo archivo, seed compartido) |
| API typecheck | 0 errores |
| Frontend lint | 0 errores (9 warnings preexistentes) |
| Frontend typecheck | 0 errores |
| Frontend tests | **149 files, 1994 passed + 1 skipped** |
| Frontend build | OK (18.05s) |
| Secret scan (patrón CI) | OK (0 coincidencias) |

Nota: las suites real-SQL están gateadas por env (`AI_REAL_SQL_TEST=1`), por lo
que CI corre verde sin SQL Server; el gate real se ejecuta localmente con la DB
desechable (misma filosofía del runbook Build 02).

## 9. GATE FINAL — REMEDIATION BUILD 06.1

```
REMEDIATION BUILD 06.1: PASS (conditional)
REAL SQL SERVER: YES (nc_b061_tools, 35/35 migraciones, 58 tablas)
REAL STAGING: NO (no disponible en el entorno)
PRODUCTION TOUCHED: NO
CANONICAL ERP TOOLS: 21/21 ejecutadas contra SQL real (matrix PASS)
GET_GOALS: BLOCKED (honesto, sin fuente autoritativa)
ANALYZE_NUTRITION_GOALS: BLOCKED (honesto, sin fuente autoritativa)
GET_ALERTS: BLOCKED (honesto, sin fuente autoritativa)
GET_EVOLUTION: PASS (datos reales)
DRUG-NUTRIENT: PASS con NO_COVERAGE/reglas documentadas (nunca invento)
STALE CERTIFICATION PROVIDER CALLS: 0 (gateway bloquea antes del provider)
GOLDEN DATASET: nutrition-golden-v1-7390ccd7 (sin cambios)
TECHNICAL REQUALIFICATION: ollama/llama3.2 5/8 (62.5%) FAIL contra golden v1;
  openai/gpt-4o-mini NOT_RUN (sin credencial)
PROFESSIONAL CLINICAL VALIDATION: NOT_DONE
PRODUCTION CLINICAL CERTIFICATION: NOT_GRANTED
EGRESS REGRESSION: PASS (aiGateway.egress + egressPolicy + manifests reales)
EVIDENCE REGRESSION: PASS (evidence envelope v2 suites verdes)
RISK REGRESSION: PASS (risk dynamics suites verdes)
RISK_3+ AUTO-PERSIST: NO (persistence guard verde)
PATIENT AI PROFESSIONAL-CERTIFICATION LEAK: NO (APPROVED_NUTRITION_SUPPORT != APPROVED_PATIENT)
STAGING GATE: BLOCKED (no hay staging real)
WORKTREE CLEAN: YES (tras commits de este reporte)
HISTORICAL SQL CREDENTIAL ROTATION: STILL_REQUIRED (acción de operador)
```

## 10. Pendientes explícitos

1. **Requalificación FAIL** → el modelo servido no cumple la barra dorada de
   abstention/safety: antes de cualquier uso clínico se requiere un modelo que
   pase 8/8, o actualizar el dataset con justificación documentada.
2. Rotación de credenciales SQL históricas (operador).
3. CI con SQL Server real: diferido; requisito documentado (runner auto-hosted
   con `AI_REAL_SQL_TEST=1` + DB desechable).
4. Cleanup: DB/login desechables y archivos temp de contraseña borrados al cierre.