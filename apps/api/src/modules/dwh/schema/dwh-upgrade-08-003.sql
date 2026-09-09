-- NUTRICLINICA DWH UPGRADE - dwh-08-002 -> dwh-08-003
--
-- SCD2 validity uses [valid_from, valid_to) UTC intervals at DATETIME2(3)
-- precision. source_version stores the authoritative OLTP ROWVERSION and is
-- the deterministic tie-breaker when two captured source states share the
-- same updated_at timestamp. Existing dwh-08-002 rows are preserved; their
-- new source metadata remains NULL because it cannot be reconstructed.

SET XACT_ABORT ON;
BEGIN TRANSACTION;
BEGIN TRY
    IF OBJECT_ID('dim_sucursal', 'U') IS NULL OR OBJECT_ID('dim_professional', 'U') IS NULL
        THROW 51020, 'dwh-08-002 dimensions are required before dwh-08-003', 1;

    IF COL_LENGTH('dim_sucursal', 'source_updated_at') IS NULL
        ALTER TABLE dim_sucursal ADD source_updated_at DATETIME2(3) NULL;
    IF COL_LENGTH('dim_sucursal', 'source_version') IS NULL
        ALTER TABLE dim_sucursal ADD source_version BINARY(8) NULL;
    IF COL_LENGTH('dim_professional', 'source_updated_at') IS NULL
        ALTER TABLE dim_professional ADD source_updated_at DATETIME2(3) NULL;
    IF COL_LENGTH('dim_professional', 'source_version') IS NULL
        ALTER TABLE dim_professional ADD source_version BINARY(8) NULL;

    IF EXISTS (
        SELECT 1
          FROM dim_sucursal
         WHERE is_current = 1
         GROUP BY sucursal_natural_id
        HAVING COUNT(*) > 1
    )
        THROW 51021, 'dim_sucursal contains more than one current row', 1;

    IF EXISTS (
        SELECT 1
          FROM dim_professional
         WHERE is_current = 1
         GROUP BY professional_natural_id
        HAVING COUNT(*) > 1
    )
        THROW 51022, 'dim_professional contains more than one current row', 1;

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dim_sucursal') AND name = 'ux_dim_sucursal_natural')
        DROP INDEX ux_dim_sucursal_natural ON dim_sucursal;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dim_professional') AND name = 'ux_dim_professional_natural')
        DROP INDEX ux_dim_professional_natural ON dim_professional;

    ALTER TABLE dim_sucursal ALTER COLUMN valid_from DATETIME2(3) NOT NULL;
    ALTER TABLE dim_sucursal ALTER COLUMN valid_to DATETIME2(3) NULL;
    ALTER TABLE dim_professional ALTER COLUMN valid_from DATETIME2(3) NOT NULL;
    ALTER TABLE dim_professional ALTER COLUMN valid_to DATETIME2(3) NULL;

    CREATE UNIQUE INDEX ux_dim_sucursal_natural
        ON dim_sucursal (sucursal_natural_id, valid_from, source_version);
    CREATE UNIQUE INDEX ux_dim_professional_natural
        ON dim_professional (professional_natural_id, valid_from, source_version);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dim_sucursal') AND name = 'ux_dim_sucursal_current')
        CREATE UNIQUE INDEX ux_dim_sucursal_current
            ON dim_sucursal (sucursal_natural_id) WHERE is_current = 1;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dim_professional') AND name = 'ux_dim_professional_current')
        CREATE UNIQUE INDEX ux_dim_professional_current
            ON dim_professional (professional_natural_id) WHERE is_current = 1;

    IF OBJECT_ID('CK_dim_sucursal_valid_interval', 'C') IS NULL
        ALTER TABLE dim_sucursal WITH CHECK ADD CONSTRAINT CK_dim_sucursal_valid_interval CHECK (
            (is_current = 1 AND valid_to IS NULL) OR
            (is_current = 0 AND valid_to IS NOT NULL AND valid_to >= valid_from)
        );
    IF OBJECT_ID('CK_dim_professional_valid_interval', 'C') IS NULL
        ALTER TABLE dim_professional WITH CHECK ADD CONSTRAINT CK_dim_professional_valid_interval CHECK (
            (is_current = 1 AND valid_to IS NULL) OR
            (is_current = 0 AND valid_to IS NOT NULL AND valid_to >= valid_from)
        );

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
