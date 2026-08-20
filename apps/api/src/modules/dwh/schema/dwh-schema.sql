-- =============================================================================
-- NUTRICLINICA DWH SCHEMA — dwh-08-001 (base SEPARADA del OLTP)
-- Convenciones:
--  * Todos los objetos con IF NOT EXISTS => inicializacion idempotente.
--  * dwh_schema_version registra schemaVersion + checksum sha256 del DDL.
--  * Ningun objeto aqui modifica el OLTP (bases distintas por config).
--  * DimPatient NO warehousena identificadores directos (privacidad).
-- =============================================================================

IF OBJECT_ID('dwh_schema_version') IS NULL
BEGIN
    CREATE TABLE dwh_schema_version (
        schema_version NVARCHAR(40) NOT NULL PRIMARY KEY,
        applied_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        checksum NVARCHAR(64) NOT NULL
    );
END;

-- -----------------------------------------------------------------------------
-- DIMENSIONES
-- -----------------------------------------------------------------------------

IF OBJECT_ID('dim_date') IS NULL
BEGIN
    CREATE TABLE dim_date (
        date_key INT NOT NULL PRIMARY KEY,
        date_value DATE NOT NULL,
        year_key SMALLINT NOT NULL,
        quarter_key TINYINT NOT NULL,
        month_key TINYINT NOT NULL,
        month_label NVARCHAR(30) NOT NULL,
        week_start_date DATE NOT NULL,
        day_of_month TINYINT NOT NULL,
        day_of_week TINYINT NOT NULL,
        day_name_es NVARCHAR(20) NOT NULL,
        is_weekend BIT NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX ux_dim_date_date_value ON dim_date (date_value);
END;

-- SCD2: conserva historia de identidad (nombre/activa/rol) por vigencia.
IF OBJECT_ID('dim_sucursal') IS NULL
BEGIN
    CREATE TABLE dim_sucursal (
        sucursal_key INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        sucursal_natural_id UNIQUEIDENTIFIER NOT NULL,
        nombre NVARCHAR(120) NOT NULL,
        activa BIT NOT NULL DEFAULT 1,
        valid_from DATE NOT NULL,
        valid_to DATE NULL,
        is_current BIT NOT NULL DEFAULT 1,
        updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX ux_dim_sucursal_natural ON dim_sucursal (sucursal_natural_id, valid_from);
END;

IF OBJECT_ID('dim_professional') IS NULL
BEGIN
    CREATE TABLE dim_professional (
        professional_key INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        professional_natural_id UNIQUEIDENTIFIER NOT NULL,
        nombre_completo NVARCHAR(160) NOT NULL,
        cedula_profesional NVARCHAR(60) NULL,
        rol NVARCHAR(30) NOT NULL,
        activo BIT NOT NULL DEFAULT 1,
        valid_from DATE NOT NULL,
        valid_to DATE NULL,
        is_current BIT NOT NULL DEFAULT 1,
        updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX ux_dim_professional_natural ON dim_professional (professional_natural_id, valid_from);
END;

-- SCD1 (minimo): solo atributos no directos. SIN nombre/email/telefono/CURP.
IF OBJECT_ID('dim_patient') IS NULL
BEGIN
    CREATE TABLE dim_patient (
        patient_key INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        patient_natural_id UNIQUEIDENTIFIER NOT NULL,
        sexo NVARCHAR(10) NULL,
        fecha_nacimiento DATE NULL,
        estado_expediente NVARCHAR(20) NULL,
        record_status NVARCHAR(20) NULL,
        updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX ux_dim_patient_natural ON dim_patient (patient_natural_id);
END;

-- -----------------------------------------------------------------------------
-- HECHOS (grano declarado en docs; upsert idempotente por clave natural)
-- -----------------------------------------------------------------------------

IF OBJECT_ID('fact_consultation') IS NULL
BEGIN
    CREATE TABLE fact_consultation (
        consultation_key BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        source_consultation_id UNIQUEIDENTIFIER NOT NULL,
        sucursal_key INT NOT NULL,
        professional_key INT NOT NULL,
        patient_key INT NOT NULL,
        date_key INT NOT NULL,
        status NVARCHAR(20) NOT NULL,
        is_deleted BIT NOT NULL DEFAULT 0,
        source_updated_at DATETIME2(3) NOT NULL,
        loaded_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX ux_fact_consultation_source ON fact_consultation (source_consultation_id);
END;

IF OBJECT_ID('fact_anthropometry') IS NULL
BEGIN
    CREATE TABLE fact_anthropometry (
        measurement_key BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        source_measurement_id UNIQUEIDENTIFIER NOT NULL,
        sucursal_key INT NOT NULL,
        professional_key INT NOT NULL,
        patient_key INT NOT NULL,
        date_key INT NOT NULL,
        weight_kg FLOAT NULL,
        height_m FLOAT NULL,
        bmi FLOAT NULL,
        is_deleted BIT NOT NULL DEFAULT 0,
        source_updated_at DATETIME2(3) NOT NULL,
        loaded_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX ux_fact_anthropometry_source ON fact_anthropometry (source_measurement_id);
END;

-- Grano: una fila por observacion de laboratorio (OPENJSON de results_json).
IF OBJECT_ID('fact_lab') IS NULL
BEGIN
    CREATE TABLE fact_lab (
        lab_observation_key BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        source_lab_panel_id UNIQUEIDENTIFIER NOT NULL,
        observation_index INT NOT NULL,
        lab_name NVARCHAR(120) NOT NULL,
        result_value NVARCHAR(200) NULL,
        result_unit NVARCHAR(40) NULL,
        sucursal_key INT NOT NULL,
        professional_key INT NOT NULL,
        patient_key INT NOT NULL,
        date_key INT NOT NULL,
        is_deleted BIT NOT NULL DEFAULT 0,
        source_updated_at DATETIME2(3) NOT NULL,
        loaded_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX ux_fact_lab_source ON fact_lab (source_lab_panel_id, observation_index);
END;

-- Grano: una fila por plan alimenticio (version autoritativa por plan).
IF OBJECT_ID('fact_meal_plan') IS NULL
BEGIN
    CREATE TABLE fact_meal_plan (
        plan_key BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        source_plan_id UNIQUEIDENTIFIER NOT NULL,
        sucursal_key INT NOT NULL,
        professional_key INT NOT NULL,
        patient_key INT NOT NULL,
        start_date_key INT NOT NULL,
        end_date_key INT NULL,
        kcal_target FLOAT NULL,
        status NVARCHAR(20) NOT NULL,
        is_deleted BIT NOT NULL DEFAULT 0,
        source_updated_at DATETIME2(3) NOT NULL,
        loaded_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX ux_fact_meal_plan_source ON fact_meal_plan (source_plan_id);
END;

-- Grano: una fila por evento de adherencia registrado (record_date).
IF OBJECT_ID('fact_adherence') IS NULL
BEGIN
    CREATE TABLE fact_adherence (
        adherence_key BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        source_adherence_id UNIQUEIDENTIFIER NOT NULL,
        sucursal_key INT NOT NULL,
        professional_key INT NOT NULL,
        patient_key INT NOT NULL,
        date_key INT NOT NULL,
        adherence_menu DECIMAL(5,2) NULL,
        adherence_water DECIMAL(5,2) NULL,
        adherence_activity DECIMAL(5,2) NULL,
        adherence_supplements DECIMAL(5,2) NULL,
        adherence_sleep DECIMAL(5,2) NULL,
        meals_logged NVARCHAR(2000) NULL,
        is_deleted BIT NOT NULL DEFAULT 0,
        source_updated_at DATETIME2(3) NOT NULL,
        loaded_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX ux_fact_adherence_source ON fact_adherence (source_adherence_id);
END;

-- -----------------------------------------------------------------------------
-- METADATA DE CARGA / GOVERNANZA
-- -----------------------------------------------------------------------------

IF OBJECT_ID('dwh_load_runs') IS NULL
BEGIN
    CREATE TABLE dwh_load_runs (
        load_run_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        pipeline_id NVARCHAR(60) NOT NULL,
        started_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        completed_at DATETIME2(3) NULL,
        status NVARCHAR(20) NOT NULL,
        source_environment NVARCHAR(60) NOT NULL,
        source_watermark DATETIME2(3) NULL,
        target_schema_version NVARCHAR(40) NOT NULL,
        transformation_version NVARCHAR(40) NOT NULL,
        rows_extracted INT NOT NULL DEFAULT 0,
        rows_inserted INT NOT NULL DEFAULT 0,
        rows_updated INT NOT NULL DEFAULT 0,
        rows_rejected INT NOT NULL DEFAULT 0,
        error_count INT NOT NULL DEFAULT 0,
        error_detail NVARCHAR(MAX) NULL,
        code_version NVARCHAR(40) NOT NULL
    );
    CREATE INDEX idx_dwh_load_runs_pipeline_started ON dwh_load_runs (pipeline_id, started_at DESC);
END;

IF OBJECT_ID('dwh_watermarks') IS NULL
BEGIN
    CREATE TABLE dwh_watermarks (
        pipeline_id NVARCHAR(60) NOT NULL PRIMARY KEY,
        watermark_at DATETIME2(3) NOT NULL,
        updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID('dwh_rejects') IS NULL
BEGIN
    CREATE TABLE dwh_rejects (
        reject_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        load_run_id BIGINT NOT NULL,
        pipeline_id NVARCHAR(60) NOT NULL,
        entity NVARCHAR(60) NOT NULL,
        source_reference NVARCHAR(120) NOT NULL,
        reason_code NVARCHAR(40) NOT NULL,
        reason_detail NVARCHAR(500) NULL,
        rejected_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX idx_dwh_rejects_run ON dwh_rejects (load_run_id);
END;

IF OBJECT_ID('dwh_reconciliation') IS NULL
BEGIN
    CREATE TABLE dwh_reconciliation (
        reconciliation_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        load_run_id BIGINT NOT NULL,
        pipeline_id NVARCHAR(60) NOT NULL,
        fact_table NVARCHAR(60) NOT NULL,
        source_expected INT NOT NULL,
        loaded INT NOT NULL,
        filtered INT NOT NULL DEFAULT 0,
        rejected INT NOT NULL DEFAULT 0,
        unexpected_loss INT NOT NULL,
        reconciled_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX ux_dwh_reconciliation_run_pipeline ON dwh_reconciliation (load_run_id, pipeline_id);
END;

IF OBJECT_ID('dwh_pipeline_locks') IS NULL
BEGIN
    CREATE TABLE dwh_pipeline_locks (
        pipeline_id NVARCHAR(60) NOT NULL PRIMARY KEY,
        locked_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        lock_token NVARCHAR(64) NOT NULL,
        lock_expires_at DATETIME2(3) NOT NULL
    );
END;

IF OBJECT_ID('dwh_metric_catalog') IS NULL
BEGIN
    CREATE TABLE dwh_metric_catalog (
        metric_id NVARCHAR(60) NOT NULL PRIMARY KEY,
        metric_version NVARCHAR(20) NOT NULL,
        status NVARCHAR(20) NOT NULL,
        definition_json NVARCHAR(MAX) NOT NULL,
        registered_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;