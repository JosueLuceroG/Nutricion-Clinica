# DWH, ETL/ELT, Analytics y BI (Fase 16)

Historico, freshness, lineage, cargas incrementales idempotentes, catalogo
semantico y Analytics API read-only. El OLTP/ERP conserva la autoridad sobre
el estado clinico actual; el DWH NUNCA modifica OLTP.

## Modelo (`modules/dwh/`)

- **Catalogo semantico** (`catalog.ts`): dimensiones `fecha` y `sucursal` y 5
  metricas (`consultas_diarias`, `pacientes_nuevos_diarios`,
  `planes_activos_diarios`, `adherencia_promedio_diaria`,
  `consultas_pendientes_pago_diarias`) con `aggregation` y `source`
  (tabla/columna + nota = lineage a nivel definicion).
- **Snapshots idempotentes**: clave natural `(metric_id, dimension_key)`; el
  guardado es upsert (memory: overwrite; SQL: UPDATE + INSERT condicional).
  Re-cargar el mismo dia no duplica filas.
- **Lineage a nivel dato**: cada snapshot referencia `source_run_id`; cada
  `dwh_load_runs` registra `{ id, started/finished, rows_loaded, status,
  error, metrics, engine_version }`.

## ETL incremental (`etl.ts`)

- `runIncrementalLoad`: por cada metrica del catalogo, consulta al
  `DailyMetricSource` (interface; `sqlDailyMetricSource` implementa las
  consultas de solo-lectura sobre OLTP) la ventana `[hoy - windowDays, hoy]`
  y upserta snapshots por dia.
- Idempotencia: ejecutar la carga dos veces produce el mismo estado.
- Fail-visible: si una metrica falla, la corrida se registra como `failed`
  con el detalle (nunca silencioso).
- El ETL solo LEE las tablas fuente; toda escritura va a `dwh_*` (migracion
  031). El dashboard OLTP existente (`/dashboard/metrics`) queda intacto.

## Freshness y lineage (`freshness.ts`)

- `computeFreshness`: por metrica, ultimo snapshot cargado, valor y flag
  `stale` segun `DWH_MAX_FRESHNESS_DAYS` (default 3). Sin datos => stale.

## Analytics API (`/dwh`, auth + sucursal + rate limit)

- `GET /catalog`: catalogo semantico (dimensiones + metricas con lineage).
- `GET /freshness`: estado de actualidad por metrica.
- `GET /runs`: ultimas corridas de carga (lineage).
- `GET /metrics/:metricId?from&to`: serie historica read-only (404 si la
  metrica no esta en el catalogo; 400 si los filtros son invalidos).
- `POST /load`: dispara la carga incremental (solo `admin`).
- `DWH_ENABLED` (default false) es el kill switch fail-closed: deshabilitado,
  todos los endpoints responden 503.

## Archivos

- `apps/api/src/modules/dwh/` (config, catalog, dwhTypes, dwhStore,
  etl, sqlDailyMetricSource, freshness, analyticsRoutes + tests)
- `apps/api/migrations/031-dwh.sql` (dwh_metric_snapshots + dwh_load_runs)
- `apps/api/src/server.ts` (monta `/dwh`)

## Estado

Completada localmente; staging pendiente: `DWH_ENABLED=true` y
`DWH_STORE=sql` (migracion 031) contra SQL Server, validacion de las
consultas del source SQL sobre datos reales, schedule de `POST /load`
(cron/job) y BI read-only (dashboards) construido sobre `/dwh/metrics`.