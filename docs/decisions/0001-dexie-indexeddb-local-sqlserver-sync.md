# ADR-001: IndexedDB/Dexie local, SQL Server vía sync

**Estado:** Aceptada · **Contexto:** Sprint 14 · **Última revisión:** Sprint 43

## Contexto

VS Build Tools no están garantizadas en todos los entornos de desarrollo.
SQLite requiere compilar native code, lo que añade fricción en Windows sin
Build Tools instalado. Necesitamos persistencia local offline-first con
capacidad de sincronización remota multi-dispositivo.

## Decisión

Usar Dexie 4 + IndexedDB como almacenamiento primario local. SQL Server
como backend de sincronización remota vía `apps/api/` con Express.

## Consecuencias

- **Positivas:** Dos adapters de persistencia claramente separados. Sync
  engine media entre ambos con detección de conflictos. Tests corren con
  `fake-indexeddb` sin cambios de configuración. Multi-tenancy y backup
  remoto resueltos por el backend.
- **Negativas:** Mantenimiento de dos esquemas (Dexie + SQL Server).
  Latencia de sync en operaciones offline→online. Complejidad añadida
  en el sync engine (retry, backoff, conflict resolution).

## Alternativas consideradas

1. **SQLite nativo con `better-sqlite3`** — requiere VS Build Tools,
   descartado por portabilidad.
2. **SQLite vía `sql.js` (WASM)** — factible pero no probado con Tauri v2.
3. **Server central sin offline** — viola el requisito offline-first.

## Referencias

- Especificación §6.4 (Arquitectura de persistencia)
- `src/services/sync/` — implementación del sync engine
- `apps/api/` — servidor Express + SQL Server
