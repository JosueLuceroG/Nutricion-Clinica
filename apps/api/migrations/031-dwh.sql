-- Fase 16: DWH
-- Historico de metricas con snapshots idempotentes (upsert por metrica +
-- dimension) y registros de carga para lineage y freshness. El DWH es
-- read-only respecto al OLTP: nunca modifica las tablas fuente.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'dwh_metric_snapshots')
BEGIN
    CREATE TABLE dwh_metric_snapshots (
        metric_id NVARCHAR(60) NOT NULL,
        dimension_key NVARCHAR(100) NOT NULL,
        value FLOAT NOT NULL,
        loaded_at DATETIME2(3) NOT NULL,
        source_run_id UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT pk_dwh_metric_snapshots PRIMARY KEY (metric_id, dimension_key)
    );

    CREATE TABLE dwh_load_runs (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        started_at DATETIME2(3) NOT NULL,
        finished_at DATETIME2(3) NOT NULL,
        rows_loaded INT NOT NULL,
        status NVARCHAR(20) NOT NULL,
        error NVARCHAR(MAX) NULL,
        metrics NVARCHAR(1000) NOT NULL,
        engine_version NVARCHAR(40) NOT NULL
    );

    CREATE INDEX idx_dwh_load_runs_started ON dwh_load_runs (started_at DESC);
END;