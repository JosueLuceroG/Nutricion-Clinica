# ADR-006: IDs branded (UUIDv7) en lugar de string

**Estado:** Aceptada · **Contexto:** Sprint 8 · **Última revisión:** Sprint 14

## Contexto

Usar `string` para IDs de entidades es propenso a bugs: es fácil pasar
un `PatientId` donde se espera un `ConsultationId`, y el compilador no
detecta el error.

## Decisión

Cada entidad tiene su `XId` branded type. Comparación con `equals()`
en lugar de `===`. Construcción con `XId.generate()` (UUIDv7) o
`XId.fromUnsafe(s)` para reconstruir desde persistencia.

## Consecuencias

- **Positivas:** Type safety real: el compilador rechaza mezclar IDs
  de diferentes entidades. UUIDv7 da ordenamiento temporal cronológico
  gratis (útil para listas y paginación). Sin overhead en runtime
  (branded types son zero-cost en TypeScript).
- **Negativas:** +1 clase por módulo (código boilerplate). Tests
  requieren `equals()` en lugar de `===`. Serialización/deserialización
  requiere conversión explícita a string.

## Alternativas consideradas

1. **`string` simple** — sin type safety, propenso a errores de
  parámetro.
2. **`type XId = string & { __brand: 'X' }`** — branded type más
  liviano pero sin métodos helper.

## Referencias

- Especificación §6.1 (Branded IDs)
- `packages/shared/src/brandedIds.ts`
