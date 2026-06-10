# ADR-004: Zod en application/ como single source of truth

**Estado:** Aceptada · **Contexto:** Sprint 5 · **Última revisión:** Sprint 24

## Contexto

La frontera entre UI y dominio es el lugar más débil para errores de
validación. Sin un SSOT (single source of truth), los schemas de
validación se duplican (Zod en UI, manual en dominio, manual en API).
Necesitamos validación declarativa con inferencia de tipos automática.

## Decisión

Cada módulo tiene su schema Zod en `application/`. Los VOs validan al
construirse (throws en构造). Los schemas validan input de UI antes de
llegar al dominio.

## Consecuencias

- **Positivas:** El dominio se mantiene puro (no importa Zod). Los
  errores son objetos `ZodError` estructurados y serializables.
  Inferencia de tipos TypeScript desde el schema. Validación
  compartida entre UI y API.
- **Negativas:** Los VOs tienen lanzamiento de errores en `new` (no
  es constructor estándar). Schemas duplican parcialmente las reglas
  de negocio (pero es intencional como defensa en capas).

## Alternativas consideradas

1. **Validación manual en cada controlador** — propenso a errores,
   difícil de mantener.
2. **Yup** — menos integración con TypeScript que Zod.
3. **class-validator + decoradores** — no funciona bien con React
   (decoradores experimentales).

## Referencias

- Especificación §6.2 (Validación)
- `src/modules/*/application/*.schema.ts`
