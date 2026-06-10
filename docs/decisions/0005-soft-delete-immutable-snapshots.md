# ADR-005: Soft delete + immutable snapshots

**Estado:** Aceptada · **Contexto:** Sprint 1 · **Última revisión:** Sprint 14

## Contexto

Los datos clínicos son evidencia legal. Borrar físicamente destruye la
auditoría. Corregir un registro clínico sin preservar el original
destruye la historia del paciente.

## Decisión

Ningún registro se borra físicamente. Soft delete con columna
`deleted_at`. Las correcciones crean un nuevo snapshot (el registro
original permanece inmutable).

## Consecuencias

- **Positivas:** Auditoría completa de todas las modificaciones.
  Cumplimiento con NOM-024 (expediente clínico no modificable).
  Posibilidad de recuperación de datos.
- **Negativas:** Las tablas crecen indefinidamente (mitigado con
  retención selectiva y cleanup periódico). Las queries de UI deben
  filtrar `deleted_at IS NULL` por defecto. Mayor complejidad en
  sync engine para manejar soft-deletes.

## Alternativas consideradas

1. **Hard delete + audit log de eliminación** — más simple pero
  imposibilita la recuperación. Riesgo regulatorio.
2. **Tablas históricas separadas** — duplica el esquema, más
  complejo de mantener.

## Referencias

- Especificación §4.5 (Soft delete)
- `src/services/sync/syncEngine.ts` — manejo de soft-deletes
- Migrations: `deleted_at` en tablas principales
