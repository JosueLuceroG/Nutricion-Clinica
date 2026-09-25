SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.sensitive_action_grants', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.sensitive_action_grants (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    profesional_id UNIQUEIDENTIFIER NOT NULL,
    action NVARCHAR(40) NOT NULL,
    scope NVARCHAR(60) NOT NULL,
    expires_at DATETIME2(3) NOT NULL,
    consumed_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_sensitive_action_grants_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_sensitive_action_grants_profesional
      FOREIGN KEY (profesional_id) REFERENCES dbo.profesionales(id),
    CONSTRAINT CK_sensitive_action_grants_action
      CHECK (action IN ('backup.export', 'backup.restore'))
  );
END;

IF NOT EXISTS (
  SELECT 1
    FROM sys.indexes
   WHERE object_id = OBJECT_ID('dbo.sensitive_action_grants')
     AND name = 'IX_sensitive_action_grants_expiry'
)
BEGIN
  CREATE INDEX IX_sensitive_action_grants_expiry
    ON dbo.sensitive_action_grants (expires_at, consumed_at);
END;

COMMIT TRANSACTION;
