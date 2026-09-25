# Future Specialization Gate (Fase 21)

Gate de gobernanza que decide cuando especializar modelos (fine-tuning,
LoRA, distillation, modelos especializados y predictive analytics):
los candidatos quedan `blocked` por defecto y solo se aprueban si TODOS
los criterios de evidencia cuantitativa se cumplen Y la gobernanza esta
satisfecha. PHI nunca entra en entrenamiento sin gobierno legal,
privacidad, desidentificacion, retencion y aprobacion profesional
explicitos.

## Evidencia cuantitativa

- `rag_recall`: computed en vivo con `evaluateRetrieval` sobre el golden
  set (`retrievalGoldenSet.ts`), determinista. Mientras el recall del
  golden set este sano, los candidatos con criterio `rag_recall lt umbral`
  quedan bloqueados (el gate solo se abre si RAG realmente no recupera).
- `model_pass_rate`: desde `AI_SPECIALIZATION_PASS_RATES`
  (`{"capability":rate}`, 0-1) con los resultados de `ai:evaluate`. JSON
  malformado o valores fuera de rango se ignoran (fail-closed); sin
  evidencia para una capability -> bloqueado.
- `cost_per_completion`: estimado con `estimateCost` sobre el modelo por
  defecto (`AI_MODEL` o `gpt-4o-mini`, 1000 prompt / 500 completion
  tokens). Criterio `gt umbral`: solo evidencia si el costo actual supera
  el umbral (justifica especializar para abaratar).

## Gobernanza

- Candidatos `requiresPHI: true`: exigen `legalReview` + `privacyReview` +
  `deidentification` + `professionalApproval` + `retentionDays > 0`.
- Candidatos sin PHI: exigen `professionalApproval`.
- Sin gobernanza completa -> `blocked`.

## API (`/ai/specialization`)

- `GET /`: catalogo de candidatos con su ultima decision y resumen de
  evidencia.
- `POST /:candidateId/evaluate`: solo rol `admin` (403 en caso contrario),
  404 candidato desconocido, 503 si el kill switch esta apagado. Registra
  la decision en el ledger.
- `requireAuth` + `requireSucursalAccess` + rate limit (60/min, prefix
  `ai-specialization`). Auditoria en `audit_log` (`entity_type`
  `ai_specialization`, operacion list/evaluate) con falla fall-soft.

## Ledger

- Memoria o SQL (migracion 034): `ai_specialization_decisions` con
  `candidate_id`, `status`, `reasons_json`, `evaluated_at`.

## Candidatos seed

- `nutrition_fine_tuning` (PHI, fine_tuning).
- `dietitian_lora` (sintetico, lora).
- `adherence_predictive_model` (PHI desidentificado, predictive_analytics).

Todos quedan `blocked` por defecto: el golden set de RAG pasa el umbral y
la gobernanza PHI esta sin completar.

## Archivos

- `apps/api/src/modules/ai/specialization/` (config, specializationTypes,
  specializationCandidates, specializationPolicy, specializationEvidence,
  specializationLedger, specializationService, specializationRoutes +
  5 archivos de test = 31 tests)
- `apps/api/migrations/034-ai-specialization-decisions.sql`
- `apps/api/src/server.ts` (monta `/ai/specialization`)
- `apps/api/.env.example` (`AI_SPECIALIZATION_ENABLED`,
  `AI_SPECIALIZATION_STORE`, `AI_SPECIALIZATION_PASS_RATES`)

## Estado

Completada localmente. El kill switch esta apagado por defecto; el
endpoint responde 503 hasta que se habilite explicitamente
(`AI_SPECIALIZATION_ENABLED=true`) y exista evidencia de pass rates desde
`ai:evaluate`.