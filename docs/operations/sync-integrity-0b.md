# Integridad OLTP y sync — contrato formalizado (Fase 0B)

**Última revisión:** Sprint 43 · **Relacionado:** ADR-001 (`docs/decisions/0001-dexie-indexeddb-local-sqlserver-sync.md`), Fase 0B del roadmap canónico.

Este documento formaliza la fuente autoritativa por entidad, el contrato de
sync (pull/push), la concurrencia optimista y las migraciones que alinean
Dexie ↔ API ↔ SQL Server tras la auditoría de integridad de 0B.

## 1. Fuente autoritativa por entidad

| Entidad syncable | Fuente autoritativa | Notas |
| --- | --- | --- |
| `pacientes` | SQL Server | Ahora incluye `clave_interna`, `birth_place`, `address`, `nationality`, `id_type`, `id_number` (migración 027). |
| `consultas` | SQL Server | Incluye billing completo: `payment_status`, `payment_concept`, `amount_paid` (migración 027). |
| `antropometrias` | SQL Server | Circunferencias/páneles en `circumferences_json`, `skinfolds_json`, `bia_json` (migración 027; backfill desde las columnas planas). |
| `lab_panels` | SQL Server | Sin cambios de columnas en 027. |
| `planes_alimenticios` | SQL Server | Sin cambios de columnas en 027. |
| `adherence_records` | SQL Server | Soft-deletes remotos visibles localmente vía `deleted_at`. |

Reglas transversales:

- El servidor es la fuente de verdad de las 6 entidades sincronizables; el
  cliente Dexie es una caché offline transaccional. **No** hay entidades
  sync-only-local en este set (los campos antes local-only de `pacientes` ya
  viven en SQL).
- `record_status` es 1:1 entre cliente y servidor:
  `active ↔ open`, `inactive ↔ closed`, `discharged ↔ discharged`,
  `referred ↔ referred` (el CHECK de SQL se amplió en la migración 027 a
  `('open','closed','discharged','referred')`). Ya no hay roundtrip lossy.
- Tablas locales no syncables (goals, allergies, intolerancias, appointments,
  expenses, gi_symptoms, snapshots, audit, etc.) mantienen su estado actual:
  local-first, fuera del contrato de sync.

## 2. Contrato de pull (delta por entidad)

- `SYNC_SCHEMA_VERSION = 2` (paquete `@nutriclinica/shared`). El cliente
  rechaza servidores con otra versión (`SyncSchemaMismatchError`).
- `GET /sync/pull` acepta `since` = JSON de **cursors por entidad**
  (`SyncPullCursors: Partial<Record<SyncableEntity, string>>`).
  `null`/ausente ⇒ pull completo.
- Cada cursor se codifica `ISO-8601@id` (tiebreaker): la query usa
  `(updated_at > @since OR (updated_at = @since AND id > @last_id))`
  ordenando `updated_at ASC, id ASC`. Evita saltarse filas con
  `updated_at` idéntico cuando una entidad se trunca en 1001 filas/página.
- La respuesta incluye `cursors` (solo entidades con cambios) y `hasMore`.
  El cliente mergea `{...prev, ...resp.cursors}` — las entidades sin cambios
  conservan su cursor — y persiste el resultado por sucursal en `sync_meta`
  (`lastPullAt:<sucursal>`), en formato JSON. Un valor legacy ISO en esa
  clave se interpreta como `null` ⇒ un pull completo (idempotente, seguro).
- El cliente aplica cada lote en **una sola transacción Dexie**
  (`db.transaction("rw", …)`): si algo falla a mitad, no quedan tablas a
  medio actualizar. Los cambios round-trip no se re-encolan (`__syncApplying`).
- Cada fila aplicada guarda `row_version` (versión del servidor) como campo
  local; nunca se envía de vuelta en el payload del push (los mappers de
  columna del servidor la filtran).

## 3. Contrato de push (concurrencia optimista)

- El enqueuer (hooks Dexie) captura `expectedRowVersion` al mutar
  (update/delete) leyendo `row_version` de la fila local; los creates no
  llevan versión. Si un item ya está `pending`, su payload **y su
  `expectedRowVersion`** se refrescan con la fila más reciente.
- El servidor procesa `POST /sync/push` con **una transacción SQL por
  operación** (`pool.transaction()` begin/commit/rollback): cada resultado
  (applied/conflict/skipped/error) es independiente y el lote completo no
  se revierte por un solo fallo.
- `delete` con `expectedRowVersion` verifica la `row_version` actual en SQL:
  desajuste ⇒ `conflict` (idempotente si la fila ya no existe ⇒ `skipped`).
- Ante `conflict`, el cliente guarda el `serverRowVersion` devuelto en el
  item de cola. La resolución "mantener local" re-empuja usando esa versión
  fresca como nueva base (no vuelve a chocar contra el mismo estado).
- Backoff exponencial real (1s→60s + jitter) en push para errores
  transitorios (red/5xx); 4xx no se reintentan.
- Higiene de cola: items atascados en `syncing` > 5 min vuelven a `pending`
  (tab cerrado a mitad de push); items en `error` con ≥ 8 reintentos
  automáticos dejan de re-empujarse (quedan visibles en diagnóstico y una
  nueva edición los sustituye).

## 4. Migraciones y compatibilidad offline

- **SQL:** la fase 0B introduce `apps/api/migrations/027-oltp-integrity.sql`
  (estilo guardado con `COL_LENGTH`, aplicable con `pnpm --filter
  @nutriclinica/api migrate`). Cambios: columnas de pago en `consultas`,
  6 campos de identidad en `pacientes`, columnas JSON en `antropometrias`
  con backfill desde las columnas planas, y CHECK ampliado de
  `record_status` (vía `sys.check_constraints` + `EXEC` dinámico).
- **Dexie:** sin bump de versión de esquema en 0B — las columnas nuevas de
  SQL mapean a campos que Dexie ya almacenaba. El contrato de pull es
  retro-compatible de forma segura (cursor legacy ⇒ pull completo).
- `SYNC_SCHEMA_VERSION` es el único gate duro de compatibilidad: un
  servidor con contrato distinto se rechaza en el manifest sin tocar datos
  locales.
- Migraciones 023/024/026/027 pendientes de aplicar en staging (no hay SQL
  Server local en el entorno de desarrollo); el checklist de pre-producción
  refleja `schema_migrations` hasta `027-oltp-integrity.sql`.

## 5. Billing y expediente (integridad transaccional)

- `Consultation.withPayment` redondea montos a 2 decimales al persistir.
- `usePatientPaymentSummary`, `useFinancialReport` y el resumen clínico
  excluyen `refunded`/`cancelled` de pendientes e ingresos (antes contaban
  como pendientes).
- Bulk-pay (`BillingPage`): una sola transacción Dexie para todo el lote
  (todo o nada) y guard concurrente — doble click — reutiliza la misma
  ejecución (idempotente).
- Snapshots de expediente: `CreateSnapshotExpedienteUseCase` es idempotente
  por `consultaId` (una consulta = un snapshot; doble disparo no duplica).