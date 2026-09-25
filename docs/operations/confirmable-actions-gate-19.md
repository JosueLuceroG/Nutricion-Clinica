# Acciones confirmables (Fase 19)

Acciones limitadas y allowlisted con permiso por rol, consentimiento,
contexto de sucursal, idempotencia, preview, confirmacion explicita,
auditoria, compensacion y rollback/roll-forward. Ninguna accion clinica
critica es ejecutable de forma automatica: el registro rechaza riesgo
alto y prefijos clinicos criticos en el arranque (fail-closed).

## Arquitectura

- `ConfirmableActionDefinition`: id unico, rol requerido, consents
  requeridos, `inputSchema` Zod, `preview` (sin efectos), `execute`,
  `compensate` opcional (rollback).
- `ActionRegistry`: registro unico; rechaza `riskLevel` fuera de
  `low|medium` y ids con prefijos clinicos criticos
  (`prescribe`, `medicate`, `diagnose`, `modify_plan`, `modify_lab`,
  `modify_consulta`, `cancel_consulta`, `update_clinical`, `refer`).
- `ActionLedger` (interfaz) con dos implementaciones:
  - `InMemoryActionLedger` (default, reloj inyectable para tests).
  - `SqlActionLedger` (`AI_ACTIONS_LEDGER_STORE=sql`) sobre
    `ai_action_confirmations` + `ai_action_executions` (migracion 032).
- `ConfirmableActionsService`: ciclo de vida
  `preview -> confirm -> execute -> rollback (compensate)`.

## Flujo y statuses

- `POST /ai/actions/:actionId/preview` `{ input, pacienteId }`:
  valida rol (403), consentimiento del paciente (400/403), input (400),
  limite de confirmaciones pendientes por actor (429), y crea una
  confirmacion con TTL (`AI_ACTIONS_CONFIRMATION_TTL_MIN`, default 10).
- `POST /:actionId/confirm` `{ confirmationId, idempotencyKey, input }`:
  la confirmacion debe pertenecer al mismo profesional y sucursal (403),
  no estar expirada (410) ni usada (409); el input debe coincidir
  exactamente con el del preview (400). Replay idempotente devuelve la
  ejecucion previa con `replayed: true`. Falla de ejecucion => 502 y
  registro `failed` (roll-forward).
- `POST /:actionId/rollback` `{ executionId, reason }`: requiere
  `compensate` (400); solo ejecuciones `executed` (409); resultado de la
  compensacion se registra en `rolled_back` (502 si falla).
- Kill switch `AI_ACTIONS_ENABLED` (default `false`): todo el endpoint
  responde 503. Limite `AI_ACTIONS_MAX_PENDING_CONFIRMATIONS` (default
  10) devuelve 429.

## Acciones seed

- `create_memory_note` (rol `nutriologa`, consentimiento `ai_memory`):
  guarda nota breve en la memoria auxiliar del paciente con
  `buildMemoryEntry` (source `professional_note`); compensa borrando la
  entrada. La memoria no es autoritativa.
- `share_educational_resource`: envia un documento educativo aprobado a
  la mensajeria del portal del paciente (`patient_portal_messages`,
  `professional_to_patient`); preview valida `status = 'approved'`;
  compensa borrando el mensaje.

## Seguridad

- `requireAuth` + `requireSucursalAccess` + rate limit
  (`60 ventana / 120 req`, prefix `ai-actions`).
- Auditoria en `audit_log` (`entity_type` `ai_action`, operacion
  preview/confirm/rollback) con falla fall-soft (no bloquea).
- Fail-closed por defecto: kill switch apagado, ledger en memoria,
  registro conservador en arranque.

## Archivos

- `apps/api/src/modules/ai/actions/` (config, actionTypes, actionLedger,
  actionRegistry, actionService, seeds, actionRoutes + 5 archivos de
  test = 40 tests)
- `apps/api/migrations/032-ai-actions.sql`
- `apps/api/src/server.ts` (monta `/ai/actions`)
- `apps/api/.env.example` (`AI_ACTIONS_ENABLED`, `AI_ACTIONS_LEDGER_STORE`,
  `AI_ACTIONS_CONFIRMATION_TTL_MIN`, `AI_ACTIONS_MAX_PENDING_CONFIRMATIONS`)

## Estado

Completada localmente. El kill switch esta apagado por defecto; el
endpoint responde 503 hasta que se habilite explicitamente
(`AI_ACTIONS_ENABLED=true`).