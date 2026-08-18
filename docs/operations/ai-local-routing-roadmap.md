# ROADMAP NUTRICLINICA_LOCAL_AUTO — Build 07.5 (NO EJECUTADO)

Preparación contractual de routing automático local (Build 07). La selección del
modelo por defecto es **Build 07.5**: este documento fija reglas y no elige modelo.

## Contrato (Build 07, verificado por test)

- `apps/api/src/modules/ai/models/nutriclinicaLocalAutoContract.ts`:
  - `mode: NUTRICLINICA_LOCAL_AUTO | MANUAL_PROVIDER` — solo preferencia de enrutamiento.
  - `localCandidates: ['llama3.2']` — informativo; llama3.2 NO es identidad de NutriClínica.
  - `applyRoutingContract`: el hint de modelo **nunca** desbloquea capacidades.
  - `resolveRoutingAvailability`: fail-closed — sin modelo local certificado → FALLBACK/NO_AVAILABLE.
  - `ROUTING_INVARIANTS`: preferencia ≠ permiso/riesgo/consenso/certificación/egress.

## Roadmap 07.5 (prohibido ejecutar en Build 07)

1. **Selección por certificación exacta**: el router elige el modelo local solo si
   `ClinicalCertificationRegistry.resolve(..., requiredState: 'APPROVED_NUTRITION_SUPPORT')`
   devuelve `eligible && !stale`. Nunca por preferencia del usuario.
2. **Modos de credenciales**:
   - LOCAL_ONLY: sin API key externa; ollama local certificado (recomendado NutriClínica).
   - LOCAL_PRIMARY: local certificado con fallback a API SOLO si el canal lo permite y
     el modo está activado explícitamente (nunca por hint de usuario).
   - API_FALLBACK: exige confirmación de canal + manifiesto de egress vigente.
3. **Requalificación**: cualquier cambio de prompt/toolset/policy/schema/dataset/
   knowledge-policy/retrieval-policy/smae → STALE → el modelo local queda NO_AVAILABLE
   hasta requalificación técnica y validación profesional.
4. **Benchmark local**: evaluar candidatos (llama3.2 hoy 5/8 FAIL en nutrition_reasoning,
   con abstenciones G002/G003) contra el golden dataset; solo candidatos con
   `APPROVED_NUTRITION_SUPPORT` exacta entran a producción clínica.
5. **Egress**: jamás desactivado por preferencia; manifest por canal/paciente.

## Reglas inmutables (heredadas de builds previos)

- `APPROVED_NUTRITION_SUPPORT != APPROVED_PATIENT`: el modo auto NO activa Patient AI.
- Validación clínica profesional sigue siendo requisito previo a producción.
- Sin staging disponible: Benchmarking/validación local solamente.