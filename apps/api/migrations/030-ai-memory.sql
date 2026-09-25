-- Fase 15: AI Memory
-- Memoria de conversacion con consentimiento opt-in, aislamiento por
-- paciente/usuario/sucursal, provenance, retencion y eliminacion.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_memory')
BEGIN
    CREATE TABLE ai_memory (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        paciente_id UNIQUEIDENTIFIER NOT NULL,
        sucursal_id UNIQUEIDENTIFIER NOT NULL,
        actor_id UNIQUEIDENTIFIER NOT NULL,
        content NVARCHAR(500) NOT NULL,
        visibility NVARCHAR(10) NOT NULL,
        source NVARCHAR(30) NOT NULL,
        created_at DATETIME2(3) NOT NULL,
        expires_at DATETIME2(3) NOT NULL
    );

    CREATE INDEX idx_ai_memory_paciente ON ai_memory (paciente_id, sucursal_id);
    CREATE INDEX idx_ai_memory_expires ON ai_memory (expires_at);
END;