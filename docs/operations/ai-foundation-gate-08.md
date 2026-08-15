# AI Foundation Gate (Fase 8)

Infraestructura de proveedores de IA en el API: `AIProviderAdapter`,
conformance suite, registries, Model Router, Fallback Policy, Model Circuit
Breaker, AI Gateway y Orchestrator, con auditoría normalizada. Todo server-side;
el contrato público de `/ai/complete` no cambia.

## Arquitectura

```
aiRoutes.ts → aiGateway → [router/fallback] → [egress policy] → adapters → provider
                          ↘ auditoría normalizada (audit_log, entity_type 'ai')
```

- `providers/aiProviderAdapter.ts`: interfaz `AIProviderAdapter.complete()` +
  `ProviderCallError` (kind: `http|network|timeout`) + `withTimeout`.
- `providers/openAiCompatibleAdapter.ts`: `OpenAICompatibleAdapter` (endpoint
  `/chat/completions`, credenciales vía `CredentialProvider`). Fábricas
  `createOpenAiAdapter()` / `createOllamaAdapter()`. `mapOpenAiResponse`
  normaliza el payload del proveedor (sin filtrar su forma).
- `providers/providerRegistry.ts`: registro de adapters.
- `models/modelRegistry.ts`: metadatos por modelo (provider, supportsJson,
  maxTokens); defaults `gpt-4o-mini` (openai) y `llama3.2` (ollama).
- `routing/modelRouter.ts`: resuelve proveedor/modelo (Ollama siempre usa el
  modelo del servidor).
- `routing/fallbackPolicy.ts`: cadena de respaldo `AI_FALLBACK_PROVIDERS`
  (default `openai,ollama`), excluyendo el primario.
- `resilience/modelCircuitBreaker.ts`: por clave `provider:model`; se abre tras
  `AI_CIRCUIT_BREAKER_THRESHOLD` fallos (default 5) y permite una sonda
  half-open tras `AI_CIRCUIT_BREAKER_COOLDOWN_MS` (default 30 s).
- `aiGateway.ts`: orquesta el flujo y devuelve `GatewayResult` con `attempts`
  (outcome por candidato: `success|policy_denied|breaker_open|provider_error`).
- `aiOrchestrator.ts`: ejecuta secuencias de pasos de forma secuencial y se
  detiene ante el primer fallo; auditable por paso.

## Semántica del gateway (fail-closed)

1. Se resuelve el objetivo primario (provider/modelo).
2. `AIDataEgressPolicy` sobre el primario: denegación es **terminal** (503 kill
   switch / 403 allowlist) y **nunca** cae a fallback.
3. Fallback solo ante fallos **operativos** (red, 5xx, timeout, breaker abierto).
4. Cada candidato del fallback también pasa por la política antes de llamarse.
5. Si todo falla: 502 (`Proveedor de IA no disponible`); 503 si el fallo es de
   configuración de credenciales (`IA no configurada en el servidor`).

## Conformance suite

`providers/aiProviderConformance.test.ts` ejecuta la misma batería contra los
adapters OpenAI y Ollama: request OpenAI-compatible, defaults seguros, mapeo de
respuesta, finish reasons, errores HTTP/red tipados y abort. **Todo adapter
nuevo debe pasar esta suite** (regla del gate).

## Auditoría normalizada

Cada request escribe en `audit_log` (entity_type `ai`, operacion `read`) con
`detalles` = `{ status, provider, model, reason?, usage?, attempts: [...] }`.
`attempts` incluye cada candidato intentado y su outcome, lo que permite
auditar fallbacks, circuit breaker y denegaciones.

## Variables de entorno nuevas

```env
AI_FALLBACK_PROVIDERS=openai,ollama
AI_CIRCUIT_BREAKER_THRESHOLD=5
AI_CIRCUIT_BREAKER_COOLDOWN_MS=30000
```

## Archivos

- `apps/api/src/modules/ai/providers/` (adapter, adapters compatibles, registry)
- `apps/api/src/modules/ai/models/modelRegistry.ts`
- `apps/api/src/modules/ai/routing/` (modelRouter, fallbackPolicy)
- `apps/api/src/modules/ai/resilience/modelCircuitBreaker.ts`
- `apps/api/src/modules/ai/aiGateway.ts`, `aiOrchestrator.ts`
- `apps/api/src/modules/ai/aiRoutes.ts` (sobre el gateway; errores normalizados
  como respuestas JSON, no excepciones)
- `apps/api/.env.example`

## Estado

Completada localmente; despliegue staging pendiente (activar
`AI_EGRESS_ENABLED` y revisar allowlists/fallback/breaker en el entorno).