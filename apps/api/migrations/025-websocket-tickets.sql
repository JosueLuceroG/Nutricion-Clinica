-- =====================================================================
-- 025-websocket-tickets.sql
-- Tickets opacos de un solo uso para conectar WebSockets autorizados
-- (telemedicina y chat). Solo se almacena el SHA-256 del ticket;
-- el valor claro vive en memoria del cliente y viaja en el query
-- string unicamente durante el handshake.
-- =====================================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.websocket_tickets', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.websocket_tickets (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ticket_hash NVARCHAR(64) NOT NULL,
    channel NVARCHAR(40) NOT NULL
      CONSTRAINT CK_websocket_tickets_channel
      CHECK (channel IN ('telemedicina', 'chat')),
    sub NVARCHAR(64) NOT NULL,
    sucursal_id UNIQUEIDENTIFIER NULL,
    resource_id UNIQUEIDENTIFIER NULL,
    paciente_id UNIQUEIDENTIFIER NULL,
    origin NVARCHAR(255) NOT NULL,
    expires_at DATETIME2(3) NOT NULL,
    consumed_at DATETIME2(3) NULL,
    revoked_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL
      CONSTRAINT DF_websocket_tickets_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_websocket_tickets_sucursal
      FOREIGN KEY (sucursal_id) REFERENCES dbo.sucursales(id)
  );
END;

IF NOT EXISTS (
  SELECT 1
    FROM sys.indexes
   WHERE object_id = OBJECT_ID('dbo.websocket_tickets')
     AND name = 'IX_websocket_tickets_hash_active'
)
BEGIN
  CREATE UNIQUE INDEX IX_websocket_tickets_hash_active
    ON dbo.websocket_tickets (ticket_hash)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;
END;

IF NOT EXISTS (
  SELECT 1
    FROM sys.indexes
   WHERE object_id = OBJECT_ID('dbo.websocket_tickets')
     AND name = 'IX_websocket_tickets_expiry'
)
BEGIN
  CREATE INDEX IX_websocket_tickets_expiry
    ON dbo.websocket_tickets (expires_at, consumed_at);
END;

COMMIT TRANSACTION;