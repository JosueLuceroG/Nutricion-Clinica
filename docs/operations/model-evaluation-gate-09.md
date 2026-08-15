# Model Evaluation Gate (Fase 9)

Qualification, certificacion granular, Model Cards, Nutrition Golden Dataset,
comparacion de modelos, version pinning y revalidacion por cambios del dataset.

## Componentes

- `evaluation/capabilities.ts`: capacidades de IA (`chat_general`,
  `structured_json`, `nutrition_reasoning`).
- `evaluation/modelCard.ts`: Model Cards (provider, version, developer, license,
  intendedUse, limitations, riesgos, capacidades, reporte de evaluacion).
- `evaluation/nutritionGoldenDataset.ts`: Nutrition Golden Dataset v1 con 8
  casos deterministicos (orientacion dietetica, abstencion y seguridad clinica)
  + `getDatasetFingerprint()` (FNV-1a determinista sobre el contenido).
- `evaluation/certification.ts`: certificacion granular por
  `provider/modelo:capacidad` (`certified | qualified | not_qualified`), con
  `evaluatedAt`, fingerprint congelado y `reportRef`. `isStale()` detecta
  revalidacion pendiente si el fingerprint actual difiere del evaluado.
- `evaluation/modelEvaluator.ts`: `ModelEvaluator` corre el dataset contra un
  runner (inyectable) y produce un `ModelEvaluationReport` con veredictos por
  caso y metrics (passRate). Grader deterministico: inclusion/exclusion de
  terminos y abstencion sin cifras inventadas.
- `evaluation/pinnedVersions.ts`: version pinning por proveedor vía
  `AI_PINNED_MODEL_VERSIONS` (JSON); defaults = versiones servidas actualmente.
- `scripts/evaluateModels.ts` + `pnpm --filter @nutriclinica/api ai:evaluate`:
  corre la evaluacion contra los modelos pineados y escribe reportes JSON en
  `evaluation/reports/`.

## Enforcement en el gateway (fail-closed)

Orden por candidato: circuit breaker → egress policy → **qualification**
(certificacion + revalidacion + pin) → adapter.

- `AI_QUALIFICATION_ENFORCED` (default `true`): solo se sirve si el modelo esta
  certificado para la capacidad requerida y su version coincide con el pin.
- Denegaciones de qualification registran `policy_denied` en `attempts`; si
  NINGUN candidato queda disponible por politica → 403 terminal.
- `/ai/complete` mapea `responseFormat: 'json'` → `structured_json`; si no, `chat_general`.
- Ollama NO esta certificado para `structured_json` (sin JSON mode): la UI que
  pide JSON con Ollama recibira 403 hasta certificar otro modelo.

## Ciclo de revalidacion

1. Se modifica `nutritionGoldenDataset.ts` → el fingerprint cambia.
2. `ai:evaluate` corre los reportes y muestra el nuevo fingerprint.
3. Actualizar `GOLDEN_DATASET_V1_FINGERPRINT` en `certification.ts` (o versionar
   el dataset) y re-certificar capacidades solo con reportes aprobados.
4. Mientras tanto, las certificaciones `certified` con fingerprint distinto son
   `stale` y el gateway las deniega (revalidacion pendiente).

## Variables de entorno nuevas

```env
AI_QUALIFICATION_ENFORCED=true
AI_PINNED_MODEL_VERSIONS={"openai":"gpt-4o-mini","ollama":"llama3.2"}
```

## Archivos

- `apps/api/src/modules/ai/evaluation/` (capabilities, modelCard, dataset,
  certification, modelEvaluator, pinnedVersions, reports/)
- `apps/api/src/modules/ai/aiGateway.ts` (checks de qualification/pin)
- `apps/api/src/modules/ai/aiRoutes.ts` (mapeo de capacidad)
- `apps/api/src/scripts/evaluateModels.ts`
- `apps/api/.env.example`

## Estado

Completada localmente; despliegue staging pendiente (revisar pins y
certificaciones antes de habilitar capacidades nuevas).