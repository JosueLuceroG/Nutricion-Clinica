# ADR-008: Bug fix T1 — Zod preprocess para NaN/null/undefined

**Estado:** Aceptada · **Contexto:** Sprint 11 (Feedback #3) · **Última revisión:** Sprint 11

## Contexto

Zod no acepta `null` en `z.string().optional()` si el valor por defecto
es `null`. Zod no acepta `z.literal(NaN)` porque `NaN !== NaN` en
JavaScript. En formularios de React, inputs numéricos vacíos producen
`NaN` o `null` que Zod rechaza con errores crípticos.

## Decisión

Usar `z.preprocess()` para normalizar `null`, `NaN`, y `undefined` a
valores válidos antes de la validación.

```ts
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().trim().max(max).optional().or(z.literal("")),
  );

const vitalField = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "number" && Number.isNaN(v) ? undefined : v),
    z.coerce.number().int().min(min).max(max).optional(),
  );
```

## Consecuencias

- **Positivas:** Mensajes de error legibles en lugar de crípticos.
  Formularios numéricos aceptan valores vacíos sin romper validación.
- **Negativas:** `z.preprocess()` añade boilerplate en cada schema.
  Fácil de olvidar en schemas nuevos (guideline: siempre usar
  `optionalText()` y `vitalField()` helpers).

## Alternativas consideradas

1. **Valores por defecto en el formulario** — no resuelve el problema
  de raíz; Zod igual rechaza null.
2. **Modificar los schemas de Zod** — no es posible, `NaN` es un
  problema de JavaScript, no de Zod.

## Referencias

- Especificación §13 ADR-008
- `src/modules/consultation/application/consultationSchema.ts`
