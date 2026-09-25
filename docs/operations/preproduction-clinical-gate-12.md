# Pre-production Clinical Gate (Fase 12)

Shadow Mode, comparacion profesional, umbrales aprobados, revision de critical
disagreements, pruebas fail-closed y rollback/disable switch para el expert.

## Componentes (`apps/api/src/modules/ai/clinicalGate/`)

- `config.ts`: configuracion fail-closed del gate.
  - `AI_EXPERT_ENABLED` (default `false`): kill switch del expert; cualquier
    valor distinto de `true` deshabilita (503 `Expert deshabilitado`).
  - `AI_SHADOW_MODE_ENABLED` (default `false`) y `AI_SHADOW_SAMPLE_RATE`
    (default `0.1`, clamp [0,1]).
  - `AI_CLINICAL_DISAGREEMENT_THRESHOLD` (default 3) y
    `AI_CLINICAL_WINDOW_DAYS` (default 7).
  - `AI_CLINICAL_REVIEW_STORE` (`memory` | `sql`, default `memory`).
- `shadowMode.ts`: Shadow Mode. `shouldShadow` muestrea con la tasa
  configurada (determinista con `rand` inyectable). Un run shadow ejecuta el
  workflow completo y produce un `ShadowRun` marcado `served` (advice servido)
  o `served: false` (muestra para comparacion).
- `comparison.ts`: veredictos `aligned | minor_divergence | critical_disagreement`
  y `classifyComparison`: un `critical_disagreement` SOLO cuenta cuando el run
  fue servido al paciente.
- `reviewStore.ts`: `ClinicalReviewStore` con implementacion in-memory para
  desarrollo local y `SqlClinicalReviewStore` (tablas `clinical_shadow_runs` y
  `clinical_reviews`, migracion `028-clinical-gate.sql`) obligatoria en
  STAGING/PRODUCTION.
- `autoDisable.ts`: cuenta critical disagreements en la ventana (por sucursal
  o global) y auto-deshabilita al alcanzar el umbral; falla cerrado ante
  errores de almacen (503 `Expert deshabilitado por revision clinica`).

## Endpoints (montados en `/ai/expert`)

- `POST /ai/expert/advice`: gate fail-closed primero (kill switch +
  auto-disable), luego consentimiento `ai_opt_in` y workflow. Si
  `AI_SHADOW_MODE_ENABLED=true`, cada advice servido se guarda como shadow run.
- `POST /ai/expert/shadow`: corre una muestra NO servida (rol `nutriologa`+,
  consentimiento, mismo gate) y la guarda para comparacion profesional.
- `POST /ai/expert/review`: el profesional compara un shadow run
  (`shadowRunId`, `verdict`, `notes`); los critical disagreements servidos
  incrementan el contador de auto-disable. Responde `{ critical, reason,
autoDisabled }`.

## Reglas de rollback

1. Kill switch manual: `AI_EXPERT_ENABLED != true` => 503 inmediato.
2. Auto-disable: >= umbral de critical disagreements en la ventana => 503.
3. Fallo del almacen de revisiones => fail-closed (503).
4. Shadow mode es opt-in y no cambia la salida servida.

## Pruebas fail-closed (DoD)

- Expert deshabilitado por env => 503.
- Auto-deshabilitado tras umbral => 503.
- Error de store => fail-closed true.
- Shadow/review exigen rol `nutriologa` y consentimiento.

## Archivos

- `apps/api/src/modules/ai/clinicalGate/` (config, shadowMode, comparison,
  reviewStore, autoDisable + tests)
- `apps/api/src/modules/ai/expert/expertRoutes.ts` (gate + /shadow + /review)
- `apps/api/migrations/028-clinical-gate.sql`
- `apps/api/.env.example`

## Estado

Completada localmente; staging pendiente (aplicar migracion 028, configurar
`AI_CLINICAL_REVIEW_STORE=sql`, validar con datos reales y calibrar umbrales
con el equipo clinico).
