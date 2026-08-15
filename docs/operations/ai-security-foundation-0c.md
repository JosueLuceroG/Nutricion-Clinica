# AI Security Foundation (Fase 0C)

Eliminación de secretos AI del frontend, `CredentialProvider`, runtime kill
switch y `AIDataEgressPolicy` con fail-closed y auditoría de egress.

## Modelo de credenciales

- La API key de OpenAI vive **exclusivamente en el servidor**: `OPENAI_API_KEY`
  (o `AI_API_KEY`).
- El frontend no almacena ni envía API keys. Se eliminaron `openAiApiKey`/
  `setOpenAiApiKey` de `preferencesStore`, el input de la Settings page y el
  campo `apiKey` de `AIRequest`/`CompleteSchema`.
- `apps/api/src/modules/ai/credentialProvider.ts` centraliza la resolución de
  credenciales (`CredentialProvider.resolve`): apiKey, baseUrl y modelo por
  proveedor, siempre desde env. `getAIProvider` normaliza `AI_PROVIDER`/
  `VITE_AI_PROVIDER`.

## Kill switch (fail-closed)

- `AI_EGRESS_ENABLED=true` habilita el egress; cualquier otro valor (o ausente)
  lo **deniega** con `503 IA deshabilitada`, sin intentar llamar al proveedor.
- Se evalúa en cada request contra `process.env`, por lo que activarlo/desactivarlo
  no requiere recompilar (sí reiniciar el proceso).

## AIDataEgressPolicy (`apps/api/src/modules/ai/aiEgressPolicy.ts`)

Decisión por request antes de cualquier `fetch`:

1. Kill switch activo (`AI_EGRESS_ENABLED=true`); si no → `503` (auditado como
   `denied/kill_switch`).
2. Proveedor en allowlist: `AI_ALLOWED_PROVIDERS` (default `openai,ollama`).
   Si no → `403` (auditado como `denied/provider`).
3. Modelo en allowlist: `AI_ALLOWED_MODELS` (coma-separada). Si no está
   configurada, el default es `gpt-4o-mini, llama3.2` más `OPENAI_MODEL` y
   `AI_MODEL`. Si no → `403` (auditado como `denied/model`).

Notas:

- Para Ollama el modelo SIEMPRE es el del servidor (`AI_MODEL`, default
  `llama3.2`); el cliente no puede elegirlo.
- El schema de `/ai/complete` es `.strict()`: campos desconocidos (incluida
  cualquier `apiKey`) → `400`.

## Auditoría de egress

Cada request queda en `audit_log` (entity_type `ai`, operacion `read`) con
`detalles` = `{ status: success|error|denied, provider, model, reason?, usage? }`.

## Variables de entorno (API)

```env
AI_EGRESS_ENABLED=false        # fail-closed: true para habilitar
AI_PROVIDER=openai             # openai | ollama (default de proveedor)
AI_ALLOWED_PROVIDERS=openai,ollama
AI_ALLOWED_MODELS=             # vacío = defaults seguros + modelos de env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
AI_MODEL=llama3.2
```

## Archivos

- `apps/api/src/modules/ai/credentialProvider.ts` (nuevo)
- `apps/api/src/modules/ai/aiEgressPolicy.ts` (nuevo)
- `apps/api/src/modules/ai/aiRoutes.ts` (endurecido)
- `src/services/ai/AIClient.ts`, `src/services/ai/AIService.ts` (sin apiKey)
- `src/store/preferencesStore.ts`, `src/app/pages/SettingsPage.tsx` (sin key/modelo)
- `src/i18n/locales/es-MX.json`, `en-US.json` (`ai.api_key_server_managed`)
- `apps/api/.env.example`

## Estado

Completada localmente; validación en staging pendiente (ajustar
`AI_EGRESS_ENABLED` y allowlists en el despliegue).