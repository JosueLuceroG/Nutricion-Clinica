# ADR-011: Mantener secretos de IA detras del backend

**Estado:** Aceptada · **Contexto:** Hardening post-Sprint 48 · **Ultima revision:** 2026-06-12

## Contexto

El cliente Tauri/React puede inspeccionarse y cualquier variable `VITE_*` queda
embebida en el bundle. Usar `VITE_AI_API_KEY` o llamar directo a OpenAI desde el
frontend exponia secretos y dificultaba auditar/controlar llamadas con datos
clinicos.

## Decisión

El frontend no habla directamente con proveedores de IA. Todas las llamadas pasan
por `POST /ai/complete` en `apps/api`, autenticado con JWT, sucursal activa,
validacion Zod y rate limit. Las llaves viven solo en `apps/api/.env` como
`OPENAI_API_KEY` y configuracion relacionada.

## Consecuencias

- **Positivas:** Las llaves no quedan en el bundle, el backend puede aplicar RBAC,
  rate limit, trazabilidad y politica de minimizacion de datos.
- **Positivas:** Cambiar proveedor/modelo no requiere publicar una nueva app si el
  contrato `/ai/complete` se mantiene.
- **Negativas:** IA requiere conectividad al backend; el cliente offline no puede
  llamar a proveedores externos sin un modo local explicito.
- **Negativas:** El backend asume costo/latencia de proxy y debe dimensionarse para
  picos de generacion.

## Alternativas consideradas

1. **Frontend directo a OpenAI con `VITE_AI_API_KEY`** — descartado por exposicion
   de secretos y falta de control central.
2. **Proveedor local solamente (Ollama)** — util a futuro, pero no cubre el modo
   cloud actual ni elimina la necesidad de una frontera segura.
3. **Proxy generico sin auth** — descartado porque permitiria abuso de cuota y no
   respeta multi-sucursal.

## Referencias

- `apps/api/src/modules/ai/aiRoutes.ts`
- `src/services/ai/AIClient.ts`
- `src/modules/meal-planner/application/chefService.ts`
- Especificación §19
