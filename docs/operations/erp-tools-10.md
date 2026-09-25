# ERP Tools (Fase 10)

Herramientas read-only de datos del ERP gobernadas para el asistente de IA:
allowlist, permisos y consentimiento centralizados, schemas estrictos, risk
metadata, provenance, freshness y resultados auditables.

## Componentes

- `tools/toolDefinition.ts`: `AIToolDefinition` + `defineTool` (obliga `readOnly:
  true` y schema de parametros estricto `.strict()`). Risk metadata
  (`riskLevel: low|medium|high`), categorias de datos (`pii|clinical|financial|
  operational`), `requiredConsent`, `minRole` y `maxAgeMs` (freshness).
- `tools/toolRegistry.ts`: registro de herramientas + fail-closed:
  `AI_TOOLS_ENABLED` (default `false`) y `AI_TOOLS_ALLOWLIST` (default vacia).
- `tools/toolAuthorization.ts`: permisos centralizados por rol (`roleSatisfies`
  sobre la jerarquia `soporte_tecnico < auditor < asistente < facturacion <
  nutriologa < admin`) y consentimiento por paciente via `consentimientos`
  (`tipo = ai_opt_in`, `aceptado = 1`).
- `tools/toolExecutionService.ts`: valida args estrictos, aplica allowlist +
  autorizacion + consentimiento, ejecuta y devuelve un `ToolResultEnvelope`
  con `provenance` (`source: 'erp'`, `query`, `retrievedAt`) y `freshness`
  (`maxAgeMs`, `ageMs`, `isFresh`). Audita cada invocacion (ok/denegado/error).
- `tools/erpToolExecutors.ts`: 6 herramientas read-only sobre SQL Server
  (solo `SELECT`, filtradas por `sucursal_id` y `deleted_at IS NULL`):
  `patient_profile` (PII), `recent_consultations`, `lab_results`, `meal_plan`,
  `adherence_summary` (clinical), `billing_history` (financial).
- `tools/toolRoutes.ts`: `POST /ai/tools/invoke` (auth + sucursal + rate limit).

## Endpoint

`POST /ai/tools/invoke` — body `{ toolId, args, pacienteId? }` (schema estricto).

- Herramientas deshabilitadas → 503 `Herramientas IA deshabilitadas`.
- Tool no permitida (no esta en allowlist) → 403.
- Args con claves desconocidas / invalidos → 400.
- Rol insuficiente → 403. Consentimiento no otorgado → 403.
- Exito → envelope: `{ toolId, ok, data, riskLevel, dataCategories, provenance, freshness }`.

La auditoria escribe en `audit_log` con `entity_type = 'ai_tool'` y
`detalles` incluyendo riesgo, categorias, actor, paciente y outcome.

## Reglas de seguridad

1. Todo tool es `readOnly: true` (forzado por `defineTool`); el ejecutor solo
   emite `SELECT` filtrados por sucursal.
2. Fail-closed: sin `AI_TOOLS_ENABLED=true` nada se ejecuta; sin allowlist
   explicita nada esta disponible.
3. Consentimiento `ai_opt_in` vigente por paciente antes de tocar datos.
4. Jerarquia de roles: datos financieros exigen `facturacion`; datos clinicos
   exigen `nutriologa`.

## Variables de entorno nuevas

```env
AI_TOOLS_ENABLED=false
AI_TOOLS_ALLOWLIST=
```

## Archivos

- `apps/api/src/modules/ai/tools/` (definition, registry, authorization,
  execution service, ERP executors, routes)
- `apps/api/src/server.ts` (monta `/ai/tools`)
- `apps/api/.env.example`

## Estado

Completada localmente; despliegue staging pendiente (habilitar tools y
allowlist, verificar consentimientos `ai_opt_in` registrados).