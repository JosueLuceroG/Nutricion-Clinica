# ADR-010: Native `<input type="checkbox">` sobre Radix Checkbox

**Estado:** Aceptada · **Contexto:** Sprint 11 · **Última revisión:** Sprint 11

## Contexto

El componente `Checkbox` de shadcn (basado en Radix UI) causaba
"Cannot update a component while rendering" en el wizard de consulta
durante el toggle de la opción "¿Se tomaron signos vitales?". El error
ocurría en condiciones de race entre el estado del wizard y el
componente controlado.

## Decisión

Usar `<input type="checkbox">` nativo con estilos Tailwind
(`accent-primary`, `focus-visible:ring-1`) en lugar del componente
Radix.

## Consecuencias

- **Positivas:** El bug de race condition desaparece. Cero
  dependencias de Radix para este caso específico. Accesibilidad
  sigue siendo buena (label asociado con `htmlFor`/`id`, focus
  visible, `aria-label`).
- **Negativas:** Perdemos la personalización visual de Radix (checkbox
  animado, icono de check customizable). Si se aisla el bug de Radix
  en el futuro, se puede reintroducir.

## Alternativas consideradas

1. **Seguir usando Radix Checkbox con workaround** — no hay workaround
  conocido para el error de race condition.
2. **Otro checkbox library** — añade dependencia para un solo uso.

## Referencias

- Especificación §0.4 anti-pattern #7
- `src/modules/consultation/ui/ConsultationWizard.tsx`
