-- 038: Build 09 - Observabilidad + Shadow validation (aditiva, no modifica 001-037).
-- Telemetria estructurada sin PHI (identificadores de ejecucion, nunca datos clinicos).
-- Store primario separado del DWH clinico (no es un segundo DWH: solo eventos operativos).
-- Retencion: eventos crudos 7d (configurable), agregados 90d (configurable).

IF OBJECT_ID('ai_telemetry_events') IS NULL
BEGIN
    CREATE TABLE ai_telemetry_events (
        event_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ts DATETIME2 NOT NULL CONSTRAINT df_ai_telemetry_events_ts DEFAULT SYSUTCDATETIME(),
        event_type NVARCHAR(64) NOT NULL,
        execution_id NVARCHAR(64) NOT NULL,
        correlation_id NVARCHAR(64) NULL,
        capability NVARCHAR(64) NULL,
        provider NVARCHAR(64) NULL,
        model NVARCHAR(64) NULL,
        tool_id NVARCHAR(64) NULL,
        status NVARCHAR(32) NOT NULL,
        reason_code NVARCHAR(64) NULL,
        risk_level NVARCHAR(16) NULL,
        duration_ms INT NULL,
        version_bundle NVARCHAR(200) NULL,
        counts_json NVARCHAR(2000) NULL
    );
    CREATE INDEX ix_ai_telemetry_events_ts ON ai_telemetry_events (ts);
    CREATE INDEX ix_ai_telemetry_events_type ON ai_telemetry_events (event_type, ts);
    CREATE INDEX ix_ai_telemetry_events_execution ON ai_telemetry_events (execution_id, event_type);
END
GO

IF OBJECT_ID('ai_telemetry_aggregates') IS NULL
BEGIN
    CREATE TABLE ai_telemetry_aggregates (
        metric_key NVARCHAR(200) NOT NULL,
        window_ts DATETIME2 NOT NULL,
        metric_type NVARCHAR(32) NOT NULL,
        value_type NVARCHAR(16) NOT NULL,
        value FLOAT NOT NULL,
        sample_count INT NOT NULL,
        updated_at DATETIME2 NOT NULL CONSTRAINT df_ai_telemetry_aggregates_updated DEFAULT SYSUTCDATETIME(),
        CONSTRAINT pk_ai_telemetry_aggregates PRIMARY KEY (metric_key, metric_type, value_type)
    );
END
GO

IF OBJECT_ID('ai_telemetry_alerts') IS NULL
BEGIN
    CREATE TABLE ai_telemetry_alerts (
        alert_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        created_at DATETIME2 NOT NULL CONSTRAINT df_ai_telemetry_alerts_created DEFAULT SYSUTCDATETIME(),
        rule_id NVARCHAR(64) NOT NULL,
        severity NVARCHAR(16) NOT NULL,
        message NVARCHAR(500) NOT NULL,
        value FLOAT NULL,
        threshold FLOAT NULL,
        acknowledged_at DATETIME2 NULL
    );
    CREATE INDEX ix_ai_telemetry_alerts_created ON ai_telemetry_alerts (created_at);
END
GO

IF OBJECT_ID('shadow_state') IS NULL
BEGIN
    CREATE TABLE shadow_state (
        state NVARCHAR(40) NOT NULL PRIMARY KEY,
        updated_at DATETIME2 NOT NULL,
        changed_by NVARCHAR(64) NOT NULL,
        transition_reason NVARCHAR(500) NULL,
        audit_json NVARCHAR(2000) NULL
    );
END
GO

IF OBJECT_ID('shadow_runs') IS NULL
BEGIN
    CREATE TABLE shadow_runs (
        shadow_run_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        created_at DATETIME2 NOT NULL CONSTRAINT df_shadow_runs_created DEFAULT SYSUTCDATETIME(),
        completed_at DATETIME2 NULL,
        correlation_id NVARCHAR(64) NULL,
        capability NVARCHAR(64) NOT NULL,
        risk_level NVARCHAR(16) NOT NULL,
        provider NVARCHAR(64) NOT NULL,
        model NVARCHAR(64) NOT NULL,
        version_bundle NVARCHAR(200) NOT NULL,
        sampled BIT NOT NULL,
        status NVARCHAR(32) NOT NULL,
        evidence_ref NVARCHAR(2000) NULL,
        execution_id NVARCHAR(64) NOT NULL
    );
    CREATE INDEX ix_shadow_runs_created ON shadow_runs (created_at);
END
GO

IF OBJECT_ID('shadow_reviews') IS NULL
BEGIN
    CREATE TABLE shadow_reviews (
        review_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        shadow_run_id BIGINT NOT NULL CONSTRAINT fk_shadow_reviews_run FOREIGN KEY (shadow_run_id) REFERENCES shadow_runs (shadow_run_id),
        reviewer_key NVARCHAR(64) NOT NULL,
        reviewer_sucursal_id NVARCHAR(64) NOT NULL,
        label NVARCHAR(64) NOT NULL,
        critical_disagreement BIT NOT NULL CONSTRAINT df_shadow_reviews_critical DEFAULT 0,
        unsafe BIT NOT NULL CONSTRAINT df_shadow_reviews_unsafe DEFAULT 0,
        evidence_sufficient BIT NULL,
        citation_valid BIT NULL,
        comment_ref NVARCHAR(500) NULL,
        reviewed_at DATETIME2 NOT NULL CONSTRAINT df_shadow_reviews_reviewed DEFAULT SYSUTCDATETIME(),
        version_bundle NVARCHAR(200) NOT NULL
    );
    CREATE INDEX ix_shadow_reviews_run ON shadow_reviews (shadow_run_id);
END
GO

IF OBJECT_ID('shadow_auto_disable_events') IS NULL
BEGIN
    CREATE TABLE shadow_auto_disable_events (
        event_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        created_at DATETIME2 NOT NULL CONSTRAINT df_shadow_auto_disable_created DEFAULT SYSUTCDATETIME(),
        trigger_code NVARCHAR(64) NOT NULL,
        severity NVARCHAR(16) NOT NULL,
        value FLOAT NULL,
        threshold FLOAT NULL,
        shadow_run_id BIGINT NULL,
        message NVARCHAR(500) NULL
    );
END
GO

IF OBJECT_ID('shadow_cohorts') IS NULL
BEGIN
    CREATE TABLE shadow_cohorts (
        cohort_key NVARCHAR(200) NOT NULL PRIMARY KEY,
        version_bundle NVARCHAR(200) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT df_shadow_cohorts_created DEFAULT SYSUTCDATETIME(),
        note NVARCHAR(500) NULL
    );
END
GO