-- Fase 19: Confirmable Actions
-- Ledger de acciones allowlisted con preview, confirmacion explicita,
-- idempotencia, compensacion y rollback. Ninguna accion clinica critica
-- se registra (rechazada en el ActionRegistry).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_action_confirmations')
BEGIN
    CREATE TABLE ai_action_confirmations (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        action_id NVARCHAR(80) NOT NULL,
        actor_profesional_id UNIQUEIDENTIFIER NOT NULL,
        actor_role NVARCHAR(40) NOT NULL,
        sucursal_id UNIQUEIDENTIFIER NOT NULL,
        paciente_id UNIQUEIDENTIFIER NULL,
        input_json NVARCHAR(MAX) NOT NULL,
        idempotency_key NVARCHAR(120) NULL,
        preview_summary NVARCHAR(400) NOT NULL,
        expires_at DATETIME2(3) NOT NULL,
        used BIT NOT NULL DEFAULT 0,
        created_at DATETIME2(3) NOT NULL
    );

    CREATE INDEX idx_ai_action_confirmations_expires ON ai_action_confirmations (expires_at);
    CREATE INDEX idx_ai_action_confirmations_actor ON ai_action_confirmations (actor_profesional_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_action_executions')
BEGIN
    CREATE TABLE ai_action_executions (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        action_id NVARCHAR(80) NOT NULL,
        confirmation_id UNIQUEIDENTIFIER NOT NULL,
        idempotency_key NVARCHAR(120) NULL,
        actor_profesional_id UNIQUEIDENTIFIER NOT NULL,
        actor_role NVARCHAR(40) NOT NULL,
        sucursal_id UNIQUEIDENTIFIER NOT NULL,
        paciente_id UNIQUEIDENTIFIER NULL,
        input_json NVARCHAR(MAX) NOT NULL,
        result_json NVARCHAR(MAX) NULL,
        error NVARCHAR(MAX) NULL,
        status NVARCHAR(30) NOT NULL,
        created_at DATETIME2(3) NOT NULL,
        confirmed_at DATETIME2(3) NOT NULL,
        executed_at DATETIME2(3) NULL,
        rolled_back_at DATETIME2(3) NULL,
        rollback_reason NVARCHAR(400) NULL
    );

    CREATE INDEX idx_ai_action_executions_idempotency ON ai_action_executions (idempotency_key);
    CREATE INDEX idx_ai_action_executions_action ON ai_action_executions (action_id, created_at DESC);
END;