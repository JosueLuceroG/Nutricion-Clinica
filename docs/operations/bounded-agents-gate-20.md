# Bounded Agents (Fase 20)

Workflows agent-like con presupuestos duros (`max_steps`, `max_tool_calls`,
`max_tokens`, `max_cost`, timeout), fuentes/tools permitidas, risk level y
confirmation policy. Cada paso revalida permisos, consentimiento, paciente,
sucursal y presupuesto. Ningun agente puede ejecutar herramientas fuera de
su allowlist ni acciones clinicas criticas.

## Arquitectura

- `BoundedAgentDefinition`: id unico, rol requerido, consents requeridos,
  `requiresPaciente`, `allowedToolIds` (solo tools del registro ERP),
  `capability` del modelo, systemPrompt, `budget`
  (`maxSteps/maxToolCalls/maxTokens/maxCost/timeoutMs`) y
  `confirmationPolicy`.
- `AgentRegistry`: registro unico que rechaza riesgo alto, ids clinicos
  criticos (mismos prefijos que acciones: `prescribe`, `medicate`,
  `diagnose`, etc.) y herramientas desconocidas (fail-closed).
- `AgentBudgetTracker` + `effectiveBudget`: el presupuesto efectivo es el
  minimo entre el diseno del agente y los limites del operador
  (`AI_AGENTS_MAX_*`). El costo se estima con `estimateCost(model, usage)`
  sobre un mapa `$ / 1K tokens` con fallback conservador.
- `AgentLedger` (memoria o SQL, migracion 033): `ai_agent_runs` con
  `steps_json`/`budget_json`, checkpoint tras cada paso del loop.

## Loop del motor (`agentEngine.ts`)

1. `run()` valida: kill switch (503), rol (403), paciente requerido (400),
   consents del paciente (403), input (400), limite de ejecuciones activas
   por actor (429), y crea el run con deadline `startedAt + timeoutMs`.
2. En cada iteracion: `tracker.check` (pasos/tools/tokens/costo/timeout,
   corta con `stopReason: 'budget'`) -> llamada al gateway con
   `responseFormat: 'json'` y `maxTokens` restante -> parse del JSON
   (`answer` o `tool`+`args`).
3. Si el modelo propone un tool: debe estar en `allowedToolIds`
   (fail-closed, 502 si no) y la ejecucion pasa por `ToolExecutionService`
   que revalida allowlist de env, schema, rol y consentimiento.
4. `confirmationPolicy`:
   - `none`: el tool se ejecuta y el loop continua.
   - `step_confirm`: el run queda `awaiting_confirmation` y devuelve
     `pending { runId, stepIndex, toolId, args }`.
5. `confirmStep()` revalida: dueno del run (403), estado (409), paso
   pendiente (409), expiracion (410), rol y consents de nuevo, presupuesto;
   ejecuta el tool y continua el loop.
6. `fetchRun()` permite consultar el estado (con propiedad 403/404).

## Seguridad

- `requireAuth` + `requireSucursalAccess` + rate limit (120/min,
  prefix `ai-agents`).
- Auditoria en `audit_log` (`entity_type` `ai_agent`, operacion
  run/confirm/fetch) con falla fall-soft; los tools auditan su propio
  `ToolAuditEvent` con `runId`/`agentId`.
- Fail-closed por defecto: `AI_AGENTS_ENABLED=false`, ledger en memoria,
  presupuestos del operador como techo, agentes sin tools clinicas.

## Agentes seed

- `nutrition_support_agent` (rol `nutriologa`, consents `ai_opt_in`,
  tools `patient_profile`/`meal_plan`/`adherence_summary`/
  `anthropometry_tool`, policy `none`).
- `patient_overview_agent` (tools `patient_profile`/`recent_consultations`/
  `lab_results`, policy `step_confirm`).

## Archivos

- `apps/api/src/modules/ai/agents/` (config, agentTypes, agentBudget,
  agentLedger, agentRegistry, agentEngine, agentRoutes + 5 archivos de
  test = 36 tests)
- `apps/api/migrations/033-ai-agent-runs.sql`
- `apps/api/src/server.ts` (monta `/ai/agents`)
- `apps/api/.env.example` (`AI_AGENTS_ENABLED`, `AI_AGENTS_LEDGER_STORE`,
  `AI_AGENTS_MAX_STEPS`, `AI_AGENTS_MAX_TOOL_CALLS`, `AI_AGENTS_MAX_TOKENS`,
  `AI_AGENTS_MAX_COST`, `AI_AGENTS_TIMEOUT_MS`,
  `AI_AGENTS_MAX_ACTIVE_RUNS_PER_ACTOR`)

## Estado

Completada localmente. El kill switch esta apagado por defecto; el
endpoint responde 503 hasta que se habilite explicitamente
(`AI_AGENTS_ENABLED=true`) y los modelos esten certificados para la
capability de cada agente. Nota: `agentRegistry` valida los tools contra
`aiToolRegistry`, que se puebla al importar `toolRoutes` (orden ya
garantizado en `server.ts`).