# ADR-009: Bug fix T2 — Guardar consulta NO es type="submit"

**Estado:** Aceptada · **Contexto:** Sprint 11 (Feedback #3) · **Última revisión:** Sprint 11

## Contexto

En el wizard de consulta, al hacer click en "Siguiente" (step 5→6), el
botón se reemplazaba por "Guardar consulta" en la misma posición del DOM
durante el re-render. El browser re-targeteaba el click al nuevo botón
y disparaba un submit del formulario antes de que el usuario revisara
el último step.

## Decisión

"Guardar consulta" es `type="button"` con `onClick={() => void onSubmit()}`
que invoca el handler de React Hook Form programáticamente, no como
submit del navegador.

```tsx
<Button type="button" onClick={() => void onSubmit()} disabled={submitting}>
  <Save /> {submitting ? "Guardando…" : "Guardar consulta"}
</Button>
```

## Consecuencias

- **Positivas:** El formulario nunca se auto-envía. El usuario debe
  hacer click explícito. La función `onSubmit()` (que es
  `methods.handleSubmit(onValid, onInvalid)`) se invoca directamente.
- **Negativas:** Contraintuitivo para desarrolladores nuevos (esperan
  `type="submit"`). Requiere documentación en el código.

## Alternativas consideradas

1. **`type="submit"` con validación** — el bug de re-targeting del
  browser persiste.
2. **Deshabilitar el botón "Siguiente" transicionalmente** — más
  complejo, no resuelve el bug base.

## Referencias

- Especificación §0.4 anti-pattern #1
- `src/modules/consultation/ui/ConsultationWizard.tsx`
