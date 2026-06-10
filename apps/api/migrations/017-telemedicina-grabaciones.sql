IF OBJECT_ID('dbo.video_grabaciones', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.video_grabaciones (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    sala_id UNIQUEIDENTIFIER NOT NULL,
    sucursal_id UNIQUEIDENTIFIER NOT NULL,
    created_by UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    duration_ms BIGINT NOT NULL DEFAULT 0,
    mime_type NVARCHAR(100) NOT NULL,
    original_size_bytes BIGINT NOT NULL DEFAULT 0,
    encrypted_size_bytes BIGINT NOT NULL DEFAULT 0,
    iv NVARCHAR(200) NOT NULL,
    consent_accepted_at DATETIME2(3) NOT NULL,
    consent_text_version NVARCHAR(100) NOT NULL,
    encrypted_blob VARBINARY(MAX) NOT NULL,
    deleted_at DATETIME2(3) NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT FK_video_grabaciones_sala FOREIGN KEY (sala_id) REFERENCES dbo.video_salas(id),
    CONSTRAINT FK_video_grabaciones_sucursal FOREIGN KEY (sucursal_id) REFERENCES dbo.sucursales(id),
    CONSTRAINT FK_video_grabaciones_created_by FOREIGN KEY (created_by) REFERENCES dbo.profesionales(id)
  );

  CREATE INDEX IX_video_grabaciones_sala ON dbo.video_grabaciones(sala_id, created_at DESC) WHERE deleted_at IS NULL;
  CREATE INDEX IX_video_grabaciones_sucursal ON dbo.video_grabaciones(sucursal_id, created_at DESC) WHERE deleted_at IS NULL;
END;
