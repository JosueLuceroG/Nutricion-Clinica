IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.video_grabaciones') AND name = 'retention_until')
BEGIN
  ALTER TABLE dbo.video_grabaciones
    ADD retention_until DATETIME2(3) NULL;
END;

IF OBJECT_ID('dbo.retention_cleanup_log', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.retention_cleanup_log (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    sucursal_id UNIQUEIDENTIFIER NULL,
    entity_type NVARCHAR(60) NOT NULL,
    entity_id UNIQUEIDENTIFIER NOT NULL,
    retention_until DATETIME2(3) NOT NULL,
    hard_deleted_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    reason NVARCHAR(500) NOT NULL,
    row_version ROWVERSION NOT NULL
  );

  CREATE INDEX IX_retention_cleanup_log_deleted ON dbo.retention_cleanup_log(hard_deleted_at DESC);
  CREATE INDEX IX_retention_cleanup_log_sucursal ON dbo.retention_cleanup_log(sucursal_id, hard_deleted_at DESC) WHERE sucursal_id IS NOT NULL;
END;
