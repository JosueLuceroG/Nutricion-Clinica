# AI Memory (Fase 15)

Memoria de conversacion y contexto de paciente recuperado bajo permisos, con
consentimiento opt-in, aislamiento por paciente/usuario/sucursal, provenance,
retencion, eliminacion, auditoria y prohibicion de usarla como fuente clinica
autoritativa.

## Dominio (`modules/ai/memory/`)

- Entrada: `{ id, pacienteId, sucursalId, actorId, content (max 500),
  visibility: private|shared, source: ai_conversation|professional_note|
  system_observation, createdAt, expiresAt }`.
- `AI_MEMORY_ENABLED` (default false, kill switch fail-closed),
  `AI_MEMORY_RETENTION_DAYS` (default 90), `AI_MEMORY_MAX_ENTRIES` (default
  50), `AI_MEMORY_STORE` (memory|sql, default memory).

## Consentimiento y aislamiento

- Escribir/leer requiere el consentimiento `ai_memory` del paciente en la
  sucursal (tabla `consentimientos`, mismo mecanismo que `ai_opt_in`).
- Aislamiento triple: las consultas siempre filtran por `pacienteId` +
  `sucursalId`; las entradas `private` solo son visibles para su autor, las
  `shared` para el equipo de la sucursal del paciente.
- El `sucursalId` de la entrada proviene de la sesion, nunca del cliente.

## Provenance, retencion y eliminacion

- Provenance: `source` + `actorId` + `createdAt` en cada entrada (quien, que
  clase de origen, cuando). En el expert se etiqueta como
  `(ai_conversation|professional_note|system_observation)`.
- Retencion: `expiresAt = createdAt + retentionDays`; las entradas vencidas se
  filtran en lectura y se purgan (`purgeExpired`) al escribir.
- Eliminacion: borrado duro por entrada, solo el autor o un `admin` de la
  sucursal; toda escritura/eliminacion se audita (`audit_log`, entity_type
  `ai_memory`, operacion `create|delete`).

## Integracion con Nutrition Expert

- `NutritionWorkflow.memoryRetriever`: recupera memoria del paciente (config +
  consentimiento + store, aislamiento incluido) si el store no falla; ante
  error degrada a memoria vacia (la memoria es contexto auxiliar, nunca
  bloqueante).
- El prompt gana la seccion `## Memoria del paciente (NO autoritativa)` con
  las instrucciones de prohibicion: la memoria NO es fuente clinica
  autoritativa, no se cita y no fundamenta recomendaciones.
- Enforce tecnicamente: las citas solo se verifican contra los documentos de
  conocimiento recuperados; si el modelo cita un id de memoria, la cita queda
  sin respaldo => abstencion `ungrounded`.
- El evidence envelope registra cada entrada usada como fuente
  `type: 'memory'` para auditoria.

## Endpoints (`/ai/memory`, auth + sucursal + rate limit)

- `POST /`: guarda memoria (rol `nutriologa`+, consentimiento `ai_memory`,
  kill switch 503).
- `GET /:pacienteId`: lista memoria del paciente con aislamiento y vigencia.
- `DELETE /:id`: borra duro (autor o admin; 404 si no existe o es de otra
  sucursal; 403 sin permiso).

## Archivos

- `apps/api/src/modules/ai/memory/` (config, memoryTypes, memoryStore,
  memoryRoutes + tests)
- `apps/api/migrations/030-ai-memory.sql` (tabla `ai_memory` + indices)
- `apps/api/src/modules/ai/expert/nutritionWorkflow.ts` (seccion de memoria +
  retriever), `expertRoutes.ts` (workflow por defecto con memoria),
  `evidenceEnvelope.ts` (fuente `memory`)

## Estado

Completada localmente; staging pendiente: `AI_MEMORY_STORE=sql` en
multi-instancia (migracion 030), alta de consentimientos `ai_memory` reales,
politica de retencion validada con el equipo clinico y revision de consejos
con contexto de memoria.