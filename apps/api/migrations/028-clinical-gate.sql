-- Fase 12: Pre-production Clinical Gate
-- Shadow mode + comparacion profesional + auto-disable por desacuerdos criticos.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'clinical_shadow_runs')
BEGIN
    CREATE TABLE clinical_shadow_runs (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        sucursal_id UNIQUEIDENTIFIER NOT NULL,
        paciente_id UNIQUEIDENTIFIER NOT NULL,
        profesional_id UNIQUEIDENTIFIER NULL,
        request_id NVARCHAR(64) NOT NULL,
        run_at DATETIME2(3) NOT NULL,
        served BIT NOT NULL,
        envelope_json NVARCHAR(MAX) NOT NULL,
        advice_json NVARCHAR(MAX) NULL,
        deleted_at DATETIME2(3) NULL
    );

    CREATE INDEX idx_clinical_shadow_sucursal_run_at ON clinical_shadow_runs (sucursal_id, run_at DESC);
    CREATE INDEX idx_clinical_shadow_paciente ON clinical_shadow_runs (paciente_id, run_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'clinical_reviews')
BEGIN
    CREATE TABLE clinical_reviews (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        sucursal_id UNIQUEIDENTIFIER NOT NULL,
        shadow_run_id UNIQUEIDENTIFIER NOT NULL,
        profesional_id UNIQUEIDENTIFIER NOT NULL,
        reviewed_at DATETIME2(3) NOT NULL,
        verdict NVARCHAR(32) NOT NULL,
        notes NVARCHAR(1000) NULL,
        deleted_at DATETIME2(3) NULL
    );

    CREATE INDEX idx_clinical_reviews_shadow ON clinical_reviews (shadow_run_id);
    CREATE INDEX idx_clinical_reviews_verdict_reviewed ON clinical_reviews (verdict, reviewed_at DESC);
END;