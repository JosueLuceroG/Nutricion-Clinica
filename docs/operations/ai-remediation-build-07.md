# AI Remediation Build 07 — RAG Versionado + Memoria + Preparación Local Auto

Branch: `hardening/remediation-07` (HEAD base `48cec66`, sin push). Fecha: 2026-08-18.

Objetivo: cerrar las capas KNOWLEDGE + MEMORY antes del benchmark de modelos.
`NUTRICLINICA_LOCAL_AUTO` queda **preparado contractualmente**; la selección del
modelo local es **Build 07.5** (NO ejecutado aquí). No se agregaron embeddings:
el baseline léxico está en el techo (ver LEXICAL BASELINE).

## 1. Alcance y capas

- **KNOWLEDGE**: versionado con ciclo de vida (draft→approved→superseded/expired/
  revoked/deleted), tiers, scope por sucursal, fingerprint de contenido, chunks,
  retrieval `retrieval-policy.v2` (sinónimos deterministas + frases + stop terms +
  `MIN_RELEVANCE_SCORE=3`), contrato de citación, detección de conflictos y
  marcadores de envenenamiento, evaluación con golden set + métricas.
- **MEMORY**: memoria conversacional (aislamiento por usuario/paciente/sucursal,
  TTL, PHI, egress) y preferencias de usuario (solo hint de routing; nunca bypass
  de certificación/riesgo/egress).
- **SQL**: migración 036 aditiva (001–035 intactas), verificada contra SQL Server
  real en bases desechables `nc_b07_*` (fresh + upgrade).
- **PREPARACIÓN 07.5**: contrato de routing `NUTRICLINICA_LOCAL_AUTO` fail-closed +
  roadmap documentado. Selección de modelo NO realizada.

## 2. KNOWLEDGE VERSIONING — PASS

- `knowledge_doc_versions`: estados `DRAFT/UNDER_REVIEW/APPROVED/SUPERSEDED/EXPIRED/
  REVOKED/DELETED`; elegible solo `APPROVED` + vigencia + rol + sucursal + tier.
- 036 agrega auditoría: `revoked_by_ref`, `superseded_by_ref` (y defaults).
- Bug real encontrado por el harness SQL: `saveVersion` era solo INSERT → violación
  de PK al transicionar el mismo (doc, version) a SUPERSEDED/REVOKED. Corregido a
  upsert (`IF EXISTS UPDATE ELSE INSERT`). El store in-memory no lo detectaba.

## 3. DOCUMENT LIFECYCLE — PASS

- `publishApprovedVersion`, `supersedeVersion`, `revokeVersion`, `markExpired`,
  `markDeleted` probados (unit + SQL real). Listas elegibles excluyen
  superseded/revoked/expired/deleted y respetan scope de sucursal.

## 4. CITATION VALIDATION — PASS

- `CITATION_CONTRACT_VERSION` + `buildCitationRef` + `validateCitationContract` +
  `verifyVersionedCitations`: cada chunk retrieved lleva documento+versión+fingerprint
  y se valida contra la versión publicada; fallo → no se cita.

## 5. POISONED/UNAUTHORIZED/REVOKED DOCUMENT RETRIEVAL — 0/28 (0/14 consultas)

- Golden set R001–R014 con `FORBIDDEN_DOC_IDS` (unauthorized, poisoned, revoked,
  expired). Métricas: `unauthorizedRetrievalRate=0`, `revokedDocumentRetrievalRate=0`
  en v1 y v2; `noAnswerCorrectness=1` en v2. Los documentos prohibidos jamás se
  recuperan; los conflictos aparecen como `knowledge-conflict` (warning), el
  envenenamiento detectado por `POISONING_MARKERS` bloquea.

## 6. LEXICAL BASELINE (retrieval-baseline-{v1,v2}.json)

| Modo | Recall@4 | HitRate@4 | MRR | unauthorized | revoked | noAnswer |
|---|---|---|---|---|---|---|
| v1 (legacy lexical) | 0.714 | 0.714 | 0.429 | 0 | 0 | 1 |
| v2 (hybrid lexical+synonyms+phrases) | **1** | **1** | 0.714 | 0 | 0 | 1 |

- v1 falla paráfrasis (R002) y sinónimos (R003). v2 alcanza recall/hit 1.
- El residual es ranking (MRR 0.714): corresponde al benchmark de modelo (07.5),
  NO justifica embeddings.

## 7. HYBRID RETRIEVAL — IMPLEMENTED; EMBEDDINGS — NOT_JUSTIFIED

- `retrieval-policy.v2` determinista: `expandTerm` incluye el término original,
  `expandPhraseMatches`, `STOP_TERMS` (protocolo/guia/manejo/v1/v2/…), score por
  título/contenido con `MIN_RELEVANCE_SCORE=3`. Reprochable, auditable, sin modelo.
- Embeddings: baseline en techo → no agregados (evitar complejidad sin ganancia).

## 8. NO-ANSWER — PASS

- Consultas sin evidencia elegible (R007/R008/R009/R011) → `noAnswer` explícito
  (`noAnswerCorrectness=1`). Nunca se fuerza el documento de menor score.

## 9. COMPARE_AGAINST_PROTOCOL — PASS

- Con RAG válido: detecta chunks versionados, mapea `ConflictSource`, flag
  `knowledge-conflict` (warning) y `poisoning-suspicion` (blocker), incluye versión
  en facts/prompt.
- Sin RAG: sigue fail-closed sin evidencia (sin cambios de comportamiento previo).

## 10. MEMORY — PASS

- `ai_conversation_memory`: aislamiento por (usuario, paciente, sucursal) verificado
  en SQL real; TTL 7 días; purga; borrado lógico (bug real corregido: `save` no
  persistía `deleted_at` → hoy sí); PHI solo a canales autorizados (egress).
- `ai_user_preferences`: keys seguras (whitelist), prohibidas rechazadas
  (`professional_review_disabled` etc.); upsert MERGE real; solo estilo/formato/routing.

## 11. CROSS-PATIENT/CROSS-TENANT MEMORY LEAKS — 0/0

- Tests de aislamiento (unit + SQL real) y `renderConversationMemoryForEgress`
  (PHI filtrada por canal): 0 fugas.

## 12. MEMORY POLICY OVERRIDE — NO

- Preferencias del usuario jamás desbloquean certificación/riesgo/egress
  (ROUTING_INVARIANTS del contrato). Test `applyUserPreferences` + bypass rejects.

## 13. NUTRICLINICA_LOCAL_AUTO — PREPARED (no implementado)

- `models/nutriclinicaLocalAutoContract.ts`: `applyRoutingContract` siempre
  `unlocksCapabilities: false`; `resolveRoutingAvailability` fail-closed.
- Roadmap: `docs/operations/ai-local-routing-roadmap.md` (Build 07.5 prohibido aquí).

## 14. LLAMA3.2 CLINICAL STATUS — FAILED_REQUALIFICATION

- Sin cambios de modelo en este build: ollama/llama3.2 sigue `5/8 (62.5%) FAIL`
  (abstenciones G002/G003); openai/gpt-4o-mini `NOT_REEVALUATED` (sin credencial).
  Es un candidato, no la identidad de NutriClínica.

## 15. CREDENTIAL MODES ROADMAP — DOCUMENTED (roadmap 07.5)

- LOCAL_ONLY / LOCAL_PRIMARY / API_FALLBACK con reglas de egress y confirmación
  de canal; el hint de usuario nunca selecciona modo.

## 16. LOCAL MODEL BENCHMARK ROADMAP — DOCUMENTED (roadmap 07.5)

- Requalificación exacta (`APPROVED_NUTRITION_SUPPORT`, sin stale) antes de
  producción clínica; validación profesional previa.

## 17. PROFESSIONAL CLINICAL VALIDATION — NOT_DONE

## 18. PRODUCTION CLINICAL CERTIFICATION — NOT_GRANTED

## 19. REAL SQL MIGRATION — PASS (SQL Server 2022 Express local)

- `nc_b07_fresh`: 001→036 con runner (`pnpm migrate`): 36/36 aplicadas, 0 errores;
  2º run 36 skip (idempotente).
- `nc_b07_upgrade`: 001→035 vía sqlcmd (legacy path, `-I -b`), checksums
  registrados, `pnpm migrate` aplicó SOLO 036; 2º run 36 skip.
- Store tests reales: `build07Stores.realSql.test.ts` 5/5 PASS; regresión ERP
  real `erpTools.realSql.test.ts` 18/18 PASS (ambos `AI_REAL_SQL_TEST=1`,
  login `nc_b07_ci`, password nunca impresa).
- Los 4 objetos nuevos (knowledge_doc_versions, knowledge_chunks,
  ai_conversation_memory, ai_user_preferences) verificados físicamente vía CRUD.

## 20. API/FRONTEND TESTS

- API: **124 archivos, 959 tests → 936 passed + 23 skipped** (22 file-pass + 2
  file-skip; skip = suites real-SQL gateadas por env). Previo: 898+18 → +38/+5.
- Frontend (no modificado en este build): 148/149 files, **1993 passed + 1 skipped**
  y 1 flake ambiental: `NewPatientWizard > creates a patient from the eight-step
  registration` agotó 60 s bajo carga del suite (60.8 s) pero **9/9 PASS aislado**
  (12 s); `git diff` confirma 0 cambios frontend en este build → no es regresión.
- NUTRICLINICA_LOCAL_AUTO contract: 4/4 PASS.

## 21. LINT/TYPECHECK/BUILD

- Lint: 0 errores, 9 warnings (pre-existentes, frontend: react-refresh/hooks).
- Typecheck API (`tsc --noEmit`): 0 errores (3 arreglados en evaluateRetrieval07;
  2 helpers de test retipados a `Parameters<builder>[0]`).
- Build frontend: no requerido (sin cambios).

## 22. TRACKED CONFIRMED SECRETS — 0

- `git grep -n -I -E "NutriCl1n1c4[_]2026!|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY"` →
  0 coincidencias.

## 23. HISTORICAL SQL CREDENTIAL ROTATION — STILL_REQUIRED (operador)

## 24. WORKTREE CLEAN — YES (tras commits de este reporte)

## 25. GATE FINAL — REMEDIATION BUILD 07

```
REMEDIATION BUILD 07: PASS
LOCAL RAG GATE: PASS (retrieval-policy.v2, golden set R001-R014)
STAGING RAG GATE: BLOCKED (no hay staging real)
KNOWLEDGE VERSIONING: PASS (036 + stores SQL reales)
DOCUMENT LIFECYCLE: PASS (supersede/revoke/expire/delete auditados)
CITATION VALIDATION: PASS (contrato + fingerprint por versión)
POISONED/UNAUTHORIZED/REVOKED DOCUMENT RETRIEVAL: 0/14 consultas
LEXICAL BASELINE: v1 Recall@4=0.714 MRR=0.429 → v2 Recall@4=1 MRR=0.714
HYBRID RETRIEVAL: IMPLEMENTED (determinista, auditado)
EMBEDDINGS: NOT_JUSTIFIED (baseline en techo)
NO-ANSWER: PASS (explícito, sin forced-lowest-score)
COMPARE_AGAINST_PROTOCOL: PASS con RAG válido / fail-closed sin RAG
PATIENT/CONVERSATION/USER PREFERENCE MEMORY: PASS (stores SQL reales)
CROSS-PATIENT/CROSS-TENANT MEMORY LEAKS: 0/0
MEMORY POLICY OVERRIDE: NO (preferencia = hint, nunca bypass)
NUTRICLINICA_LOCAL_AUTO: PREPARED (contrato fail-closed; selección = 07.5)
LLAMA3.2 CLINICAL STATUS: FAILED_REQUALIFICATION (5/8; openai NOT_REEVALUATED)
CREDENTIAL MODES ROADMAP: DOCUMENTED (07.5)
LOCAL MODEL BENCHMARK ROADMAP: DOCUMENTED (07.5)
PROFESSIONAL CLINICAL VALIDATION: NOT_DONE
PRODUCTION CLINICAL CERTIFICATION: NOT_GRANTED
REAL SQL MIGRATION: PASS (nc_b07_fresh 36/36 + nc_b07_upgrade 035→036, idempotente)
API TESTS: 936 passed + 23 skipped (959 tests, 124 files)
FRONTEND TESTS: 1993 passed + 1 skipped (1 flake ambiental documentado)
LINT/TYPECHECK/BUILD: 0 errores / 0 errores / sin cambios
TRACKED CONFIRMED SECRETS: 0
HISTORICAL SQL CREDENTIAL ROTATION: STILL_REQUIRED (operador)
WORKTREE CLEAN: YES
```

## 26. Pendientes explícitos

1. Build 07.5 = selección del modelo local (benchmark + requalificación); NO ejecutar
   como parte de este build.
2. Rotación de credenciales SQL históricas (operador).
3. Staging real inexistente: el gate de staging queda BLOCKED hasta disponibilidad.
4. CI con SQL Server real: diferido (runner con `AI_REAL_SQL_TEST=1` + DB desechable).
5. Flake `NewPatientWizard` bajo carga: candidato a `testTimeout` mayor o serial run.

## 27. Cierre

- DBs/login desechables `nc_b07_*` y archivo temp de contraseña borrados al cierre
  (ver sección 19).
- Commits en `hardening/remediation-07`, sin push. Worktree limpio verificado.