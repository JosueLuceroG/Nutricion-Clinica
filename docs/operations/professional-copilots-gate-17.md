# Professional Copilots (Fase 17)

Catalogo de copilotos profesionales que comparten la infraestructura AI
comun (gateway, capabilities, consentimientos, tools deterministas, RAG,
gates clinicos y auditoria). Nutrition Expert es el copiloto activo de
referencia; Clinical, Medical y Nursing Expert quedan registrados como
planificados y fail-closed hasta que existan sus roles, permisos, fuentes,
tools, workflows, datasets y gates clinicos.

## Registro (`modules/ai/copilots/copilotRegistry.ts`)

Cada copiloto declara:

- `status`: `active` | `planned`.
- `requiredRole`: rol minimo (null si el rol aun no existe).
- `capabilities`: capabilities calificadas/certificadas del gateway.
- `consentTypes`: consentimientos requeridos (`ai_opt_in`, `ai_memory`).
- `tools`: tools deterministas autorizadas.
- `sources`: fuentes ERP que alimentan el contexto.
- `gate`: gate clinico aplicable (`expert_clinical` | `pending`).

Entradas:

| id | estado | rol | nota |
|---|---|---|---|
| `nutrition` | active | nutriologa | capabilities `nutrition_reasoning`, consents `ai_opt_in`+`ai_memory`, gate `expert_clinical` |
| `clinical` | planned | (no existe) | rol clinico, fuentes, tools, datasets y gates pendientes |
| `medical` | planned | (no existe) | rol medico y dependencias pendientes |
| `nursing` | planned | (no existe) | rol de enfermeria y dependencias pendientes |

## Disponibilidad fail-closed (`copilotAvailability`)

- `planned` => no disponible para cualquier rol, con la razon declarada.
- Rol sin permiso => no disponible (mismo orden que `roleSatisfies`).
- Solo `nutrition` con rol `nutriologa`+ esta disponible hoy.

## API (`/ai/copilots`, auth + sucursal + rate limit)

- `GET /`: catalogo completo con `availability` calculada por actor.
- `GET /:copilotId`: detalle con disponibilidad; 404 si no existe.

La invocacion de cada copiloto sigue siendo por su gate y rutas propias
(p.ej. `/ai/expert/advice` para Nutrition).

## Archivos

- `apps/api/src/modules/ai/copilots/` (copilotRegistry, copilotRoutes + tests)
- `apps/api/src/server.ts` (monta `/ai/copilots`)

## Estado

Completada localmente. Los copilotos planificados se activaran en fases
futuras cuando existan roles y dependencias; no se invocan bajo ninguna
condicion hoy (fail-closed).