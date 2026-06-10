# ADR-003: SMAE 5ª edición como única fuente nutricional

**Estado:** Aceptada · **Contexto:** Sprint 9 · **Última revisión:** Sprint 15

## Contexto

Necesitamos un estándar único para expresar porciones de alimento en los
planes de alimentación. El mercado mexicano usa SMAE (Sistema Mexicano de
Alimentos Equivalentes) como referencia oficial para educación nutricional.

## Decisión

Todas las unidades de alimento en planes son equivalentes SMAE, no
calorías crudas ni porciones en gramos.

## Consecuencias

- **Positivas:** Planes culturalmente apropiados para México.
  Intercambios flexibles (el paciente puede sustituir alimentos del
  mismo grupo). Comparables entre nutriólogos. Alineados con la
  práctica clínica real.
- **Negativas:** Requiere catálogos mantenidos manualmente (módulo
  `smae`). No aplicable directamente en otros países (pero el módulo
  es reemplazable). Los cálculos calóricos requieren conversión SMAE → kcal.

## Alternativas consideradas

1. **Base de datos de USDA/SR Legacy** — más precisa calóricamente
   pero no refleja equivalentes mexicanos.
2. **Gramos directos** — perderías el concepto de equivalentes que
   usan los nutriólogos.

## Referencias

- Especificación §3.8 (módulo SMAE)
- `src/modules/smae/` — implementación del catálogo
